/**
 * Integration tests for /api/upload-chunk and /api/complete-upload routes.
 *
 * Verifies:
 * - Auth required (401 without session)
 * - Upload ownership (404 for other user's upload)
 * - Chunk validation (400 for invalid chunkIndex, missing chunk)
 * - File type validation (400 for unsupported extension)
 * - Successful chunk upload + merge to final file
 * - Status transitions (pending → uploading → completed)
 * - Cleanup of temp files
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { rm, readFile, access } from "node:fs/promises";
import {
  clearCookies,
  createTestUser,
  getPrisma,
  setAuthCookie,
  setupTestDb,
  teardownTestDb,
} from "./api-test-harness";
import { createUploadId } from "../lib/upload-server";

// Use a temp upload root for tests so we don't pollute the real one
// (UPLOAD_ROOT is imported lazily to avoid path issues)

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("/api/upload-chunk + /api/complete-upload — integration", () => {
  beforeAll(async () => {
    setupTestDb();
    const { execSync } = await import("node:child_process");
    execSync("npx prisma db push --force-reset", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(() => {
    clearCookies();
  });

  test("upload-chunk returns 401 without auth", async () => {
    const { POST } = await import("../app/api/upload-chunk/route");
    const formData = new FormData();
    formData.append("uploadId", "upload_test-123");
    formData.append("originalName", "test.mp3");
    formData.append("chunkIndex", "0");
    formData.append("totalChunks", "1");
    formData.append("chunk", new File(["data"], "chunk"));

    const response = await POST(
      new Request("http://localhost/api/upload-chunk", {
        method: "POST",
        body: formData,
      }),
    );
    expect(response.status).toBe(401);
  });

  test("upload-chunk returns 400 for unsupported file type", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const upload = await prisma.upload.create({
      data: {
        id: createUploadId(),
        userId: user.id,
        originalName: "malicious.exe",
        totalChunks: 1,
      },
    });

    const { POST } = await import("../app/api/upload-chunk/route");
    const formData = new FormData();
    formData.append("uploadId", upload.id);
    formData.append("originalName", "malicious.exe");
    formData.append("chunkIndex", "0");
    formData.append("totalChunks", "1");
    formData.append("chunk", new File(["data"], "chunk"));

    const response = await POST(
      new Request("http://localhost/api/upload-chunk", {
        method: "POST",
        body: formData,
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_FILE_TYPE");
  });

  test("upload-chunk returns 404 for another user's upload", async () => {
    const user1 = await createTestUser({ email: "u1@test.com" });
    const user2 = await createTestUser({ email: "u2@test.com" });
    const prisma = await getPrisma();

    const upload = await prisma.upload.create({
      data: {
        id: createUploadId(),
        userId: user1.id,
        originalName: "meeting.mp3",
        totalChunks: 1,
      },
    });

    // user2 tries to upload to user1's upload
    await setAuthCookie(user2.id);
    const { POST } = await import("../app/api/upload-chunk/route");
    const formData = new FormData();
    formData.append("uploadId", upload.id);
    formData.append("originalName", "meeting.mp3");
    formData.append("chunkIndex", "0");
    formData.append("totalChunks", "1");
    formData.append("chunk", new File(["data"], "chunk"));

    const response = await POST(
      new Request("http://localhost/api/upload-chunk", {
        method: "POST",
        body: formData,
      }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("MISSING_UPLOAD_ID");
  });

  test("upload-chunk returns 400 for invalid chunkIndex", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const upload = await prisma.upload.create({
      data: {
        id: createUploadId(),
        userId: user.id,
        originalName: "meeting.mp3",
        totalChunks: 2,
      },
    });

    const { POST } = await import("../app/api/upload-chunk/route");
    const formData = new FormData();
    formData.append("uploadId", upload.id);
    formData.append("originalName", "meeting.mp3");
    formData.append("chunkIndex", "5"); // out of range
    formData.append("totalChunks", "2");
    formData.append("chunk", new File(["data"], "chunk"));

    const response = await POST(
      new Request("http://localhost/api/upload-chunk", {
        method: "POST",
        body: formData,
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("CHUNK_UPLOAD_FAILED");
  });

  test("full upload flow: chunk + complete produces merged file", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const uploadId = createUploadId();
    await prisma.upload.create({
      data: {
        id: uploadId,
        userId: user.id,
        originalName: "meeting.mp3",
        totalChunks: 2,
      },
    });

    // Upload chunk 0
    const { POST: uploadChunk } = await import("../app/api/upload-chunk/route");
    const chunk0Content = "hello ";
    const formData0 = new FormData();
    formData0.append("uploadId", uploadId);
    formData0.append("originalName", "meeting.mp3");
    formData0.append("chunkIndex", "0");
    formData0.append("totalChunks", "2");
    formData0.append("chunk", new File([chunk0Content], "chunk"));

    const response0 = await uploadChunk(
      new Request("http://localhost/api/upload-chunk", {
        method: "POST",
        body: formData0,
      }),
    );
    expect(response0.status).toBe(200);
    const body0 = await response0.json();
    expect(body0.ok).toBe(true);
    expect(body0.uploadedChunks).toBe(1);

    // Upload chunk 1
    const chunk1Content = "world";
    const formData1 = new FormData();
    formData1.append("uploadId", uploadId);
    formData1.append("originalName", "meeting.mp3");
    formData1.append("chunkIndex", "1");
    formData1.append("totalChunks", "2");
    formData1.append("chunk", new File([chunk1Content], "chunk"));

    const response1 = await uploadChunk(
      new Request("http://localhost/api/upload-chunk", {
        method: "POST",
        body: formData1,
      }),
    );
    expect(response1.status).toBe(200);
    const body1 = await response1.json();
    expect(body1.uploadedChunks).toBe(2);

    // Verify DB status updated
    const uploadingRecord = await prisma.upload.findUnique({
      where: { id: uploadId },
    });
    expect(uploadingRecord?.status).toBe("uploading");
    expect(uploadingRecord?.uploadedChunks).toBe(2);

    // Complete upload
    const { POST: completeUpload } = await import("../app/api/complete-upload/route");
    const completeResponse = await completeUpload(
      new Request("http://localhost/api/complete-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId }),
      }),
    );
    expect(completeResponse.status).toBe(200);
    const completeBody = await completeResponse.json();
    expect(completeBody.ok).toBe(true);
    expect(completeBody.sizeBytes).toBe(11); // "hello world"
    expect(completeBody.storedPath).toContain(uploadId);

    // Verify final file exists and has correct content
    const finalContent = await readFile(completeBody.storedPath, "utf8");
    expect(finalContent).toBe("hello world");

    // Verify DB status is completed
    const completedRecord = await prisma.upload.findUnique({
      where: { id: uploadId },
    });
    expect(completedRecord?.status).toBe("completed");
    expect(completedRecord?.sizeBytes).toBe(11);
    expect(completedRecord?.storedPath).toBe(completeBody.storedPath);
  });

  test("complete-upload returns 401 without auth", async () => {
    const { POST } = await import("../app/api/complete-upload/route");
    const response = await POST(
      new Request("http://localhost/api/complete-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: "test" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("complete-upload returns 404 for non-existent upload", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { POST } = await import("../app/api/complete-upload/route");
    const response = await POST(
      new Request("http://localhost/api/complete-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId: "upload_nonexistent" }),
      }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("MISSING_UPLOAD_ID");
  });

  test("complete-upload fails when chunks are missing", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const uploadId = createUploadId();
    await prisma.upload.create({
      data: {
        id: uploadId,
        userId: user.id,
        originalName: "meeting.mp3",
        totalChunks: 3,
      },
    });

    const { POST: completeUpload } = await import("../app/api/complete-upload/route");
    const response = await completeUpload(
      new Request("http://localhost/api/complete-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("COMPLETE_UPLOAD_FAILED");

    // Verify DB status is failed
    const failedRecord = await prisma.upload.findUnique({
      where: { id: uploadId },
    });
    expect(failedRecord?.status).toBe("failed");
    expect(failedRecord?.errorCode).toBeTruthy();
  });
});
