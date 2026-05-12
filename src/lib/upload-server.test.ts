import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  MAX_UPLOAD_SIZE_BYTES,
  buildChunkPath,
  buildFinalPath,
  mergeChunksToFinalFile,
  sanitizeFilename,
  validateMediaFilename,
  validateStoredUploadPath,
} from "./upload-server";

describe("upload server helpers", () => {
  const safeUploadId = "upload_00000000-0000-4000-8000-000000000000";

  test("sanitizes filenames and blocks path traversal", () => {
    expect(sanitizeFilename("../../CEO Session Recording.MP4")).toBe(
      "CEO_Session_Recording.MP4",
    );
    expect(sanitizeFilename("   ")).toBe("upload.bin");
  });

  test("validates supported media extensions case insensitively", () => {
    expect(validateMediaFilename("meeting.MP4")).toEqual({
      ok: true,
      extension: "mp4",
    });
    expect(validateMediaFilename("meeting.pdf")).toEqual({
      ok: false,
      error: "Unsupported file format. Use MP3, MP4, WAV, or M4A.",
    });
  });

  test("builds upload paths inside the upload root", () => {
    const root = "/tmp/uploads";
    const uploadId = "upload_abc123";

    expect(buildChunkPath(root, uploadId, 3)).toBe(
      path.join(root, uploadId, "chunks", "3"),
    );
    expect(buildFinalPath(root, uploadId, "../meeting.mp3")).toBe(
      path.join(root, uploadId, "final", "meeting.mp3"),
    );
  });

  test("merges chunks in numeric order and returns final file details", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-test-"));
    const uploadId = safeUploadId;

    try {
      await mkdir(path.join(root, uploadId, "chunks"), { recursive: true });
      await writeFile(buildChunkPath(root, uploadId, 1), "world");
      await writeFile(buildChunkPath(root, uploadId, 0), "hello ");

      const result = await mergeChunksToFinalFile({
        uploadRoot: root,
        uploadId,
        originalName: "meeting.MP3",
        totalChunks: 2,
      });

      expect(result.originalName).toBe("meeting.MP3");
      expect(result.storedPath).toBe(
        path.join(root, uploadId, "final", "meeting.MP3"),
      );
      expect(result.sizeBytes).toBe(11);
      expect(result.totalChunks).toBe(2);
      expect(await readFile(result.storedPath, "utf8")).toBe("hello world");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects completed uploads above one gigabyte", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-test-"));
    const uploadId = safeUploadId;

    try {
      await mkdir(path.join(root, uploadId, "chunks"), { recursive: true });
      await writeFile(buildChunkPath(root, uploadId, 0), "");

      await expect(
        mergeChunksToFinalFile({
          uploadRoot: root,
          uploadId,
          originalName: "meeting.wav",
          totalChunks: 1,
          maxSizeBytes: -1,
        }),
      ).rejects.toThrow("File vượt quá giới hạn 1GB.");
      expect(MAX_UPLOAD_SIZE_BYTES).toBe(1024 * 1024 * 1024);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects missing chunks before writing the final file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-test-"));
    const finalPath = buildFinalPath(root, safeUploadId, "meeting.m4a");

    try {
      await expect(
        mergeChunksToFinalFile({
          uploadRoot: root,
          uploadId: safeUploadId,
          originalName: "meeting.m4a",
          totalChunks: 2,
        }),
      ).rejects.toThrow("Upload chưa đầy đủ chunk. Vui lòng thử lại.");
      await expect(fileExists(finalPath)).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("validates completed upload paths are inside the upload folder", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-test-"));
    const uploadId = safeUploadId;
    const finalPath = buildFinalPath(root, uploadId, "meeting.mp4");

    try {
      await mkdir(path.dirname(finalPath), { recursive: true });
      await writeFile(finalPath, "media");

      await expect(
        validateStoredUploadPath({
          uploadRoot: root,
          uploadId,
          storedPath: finalPath,
          originalName: "meeting.mp4",
        }),
      ).resolves.toBe(finalPath);

      await expect(
        validateStoredUploadPath({
          uploadRoot: root,
          uploadId,
          storedPath: path.join(root, "other-upload", "final", "meeting.mp4"),
          originalName: "meeting.mp4",
        }),
      ).rejects.toThrow("Đường dẫn file upload không hợp lệ.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
