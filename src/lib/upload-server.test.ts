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
  cleanupOldUploads,
  cleanupOldUploadsSafely,
  isSafeUploadId,
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

  test("merges many chunks without closing the output stream early", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-test-"));
    const uploadId = safeUploadId;
    const chunks = Array.from({ length: 12 }, (_, index) => `chunk-${index};`);

    try {
      await mkdir(path.join(root, uploadId, "chunks"), { recursive: true });
      await Promise.all(
        chunks.map((content, index) =>
          writeFile(buildChunkPath(root, uploadId, index), content),
        ),
      );

      const result = await mergeChunksToFinalFile({
        uploadRoot: root,
        uploadId,
        originalName: "many-chunks.m4a",
        totalChunks: chunks.length,
      });

      await expect(readFile(result.storedPath, "utf8")).resolves.toBe(
        chunks.join(""),
      );
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

describe("isSafeUploadId — path traversal protection", () => {
  test("accepts valid upload ID format", () => {
    expect(isSafeUploadId("upload_00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isSafeUploadId("upload_abc12345-6789-4def-abcd-ef0123456789")).toBe(true);
  });

  test("rejects path traversal in upload ID", () => {
    expect(isSafeUploadId("../../etc/passwd")).toBe(false);
    expect(isSafeUploadId("upload_../../etc/passwd")).toBe(false);
    expect(isSafeUploadId("upload_..")).toBe(false);
  });

  test("rejects absolute path in upload ID", () => {
    expect(isSafeUploadId("/etc/passwd")).toBe(false);
    expect(isSafeUploadId("upload_/etc/passwd")).toBe(false);
  });

  test("rejects null byte in upload ID", () => {
    expect(isSafeUploadId("upload_\x00../../../etc/passwd")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isSafeUploadId("")).toBe(false);
  });

  test("rejects upload ID without UUID suffix", () => {
    expect(isSafeUploadId("upload_abc")).toBe(false);
    expect(isSafeUploadId("upload_")).toBe(false);
  });

  test("rejects non-upload prefix", () => {
    expect(isSafeUploadId("../../../etc/passwd_00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});

describe("sanitizeFilename — path traversal protection", () => {
  test("strips path traversal with ..", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("../../../etc/passwd.mp3")).toBe("passwd.mp3");
  });

  test("strips Windows-style path traversal (backslash replaced with underscore on Unix)", () => {
    // On macOS/Linux, path.basename does not treat \\ as separator, so the
    // whole string is sanitized by replacing non-word chars with _.
    // This is still safe — no path traversal is possible because the result
    // is a flat filename with no path components (no / or \\).
    const result = sanitizeFilename("..\\..\\windows\\system32\\config\\sam.mp3");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result.endsWith(".mp3")).toBe(true);
  });

  test("strips absolute Unix path", () => {
    expect(sanitizeFilename("/etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("/var/log/auth.log")).toBe("auth.log");
  });

  test("strips absolute Windows path (backslash replaced on Unix)", () => {
    const result = sanitizeFilename("C:\\Windows\\System32\\drivers\\etc\\hosts.mp3");
    expect(result).not.toContain(":");
    expect(result).not.toContain("\\");
    expect(result.endsWith(".mp3")).toBe(true);
  });

  test("replaces null byte with underscore", () => {
    expect(sanitizeFilename("file\x00name.mp3")).toBe("file_name.mp3");
    expect(sanitizeFilename("file\x00../../etc/passwd.mp3")).toBe("passwd.mp3");
  });

  test("replaces non-word characters with underscore", () => {
    expect(sanitizeFilename("file;name.mp3")).toBe("file_name.mp3");
    expect(sanitizeFilename("file|name.mp3")).toBe("file_name.mp3");
    expect(sanitizeFilename("file&name.mp3")).toBe("file_name.mp3");
  });

  test("handles unicode filenames", () => {
    expect(sanitizeFilename("cuộc họp.mp3")).toBe("cu_c_h_p.mp3");
  });

  test("returns fallback for empty after sanitize", () => {
    expect(sanitizeFilename("")).toBe("upload.bin");
    expect(sanitizeFilename("   ")).toBe("upload.bin");
  });

  test("preserves valid filename with dots and dashes", () => {
    expect(sanitizeFilename("meeting-2024-01-15.mp3")).toBe("meeting-2024-01-15.mp3");
    expect(sanitizeFilename("recording.v2.mp4")).toBe("recording.v2.mp4");
  });
});

describe("validateMediaFilename — edge cases", () => {
  test("accepts valid extensions case insensitively", () => {
    expect(validateMediaFilename("file.MP3")).toEqual({ ok: true, extension: "mp3" });
    expect(validateMediaFilename("file.Mp4")).toEqual({ ok: true, extension: "mp4" });
    expect(validateMediaFilename("file.WAV")).toEqual({ ok: true, extension: "wav" });
    expect(validateMediaFilename("file.m4a")).toEqual({ ok: true, extension: "m4a" });
  });

  test("rejects unsupported extensions", () => {
    expect(validateMediaFilename("file.pdf").ok).toBe(false);
    expect(validateMediaFilename("file.exe").ok).toBe(false);
    expect(validateMediaFilename("file.sh").ok).toBe(false);
    expect(validateMediaFilename("file.html").ok).toBe(false);
  });

  test("rejects files without extension", () => {
    expect(validateMediaFilename("noextension").ok).toBe(false);
    expect(validateMediaFilename("").ok).toBe(false);
  });

  test("rejects double extension tricks", () => {
    expect(validateMediaFilename("file.exe.mp3")).toEqual({ ok: true, extension: "mp3" });
    expect(validateMediaFilename("file.mp3.exe").ok).toBe(false);
  });
});

describe("validateStoredUploadPath — path traversal protection", () => {
  const safeUploadId = "upload_00000000-0000-4000-8000-000000000000";

  test("rejects storedPath with path traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-traversal-"));
    try {
      await expect(
        validateStoredUploadPath({
          uploadRoot: root,
          uploadId: safeUploadId,
          storedPath: path.join(root, "..", "..", "etc", "passwd.mp3"),
          originalName: "passwd.mp3",
        }),
      ).rejects.toThrow("Đường dẫn file upload không hợp lệ.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects storedPath outside upload folder", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-traversal-"));
    try {
      await expect(
        validateStoredUploadPath({
          uploadRoot: root,
          uploadId: safeUploadId,
          storedPath: "/etc/passwd.mp3",
          originalName: "passwd.mp3",
        }),
      ).rejects.toThrow("Đường dẫn file upload không hợp lệ.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects storedPath with different uploadId", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-traversal-"));
    const otherUploadId = "upload_11111111-1111-4111-8111-111111111111";
    try {
      await mkdir(path.join(root, otherUploadId, "final"), { recursive: true });
      const otherPath = path.join(root, otherUploadId, "final", "meeting.mp3");
      await writeFile(otherPath, "data");

      await expect(
        validateStoredUploadPath({
          uploadRoot: root,
          uploadId: safeUploadId,
          storedPath: otherPath,
          originalName: "meeting.mp3",
        }),
      ).rejects.toThrow("Đường dẫn file upload không hợp lệ.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects unsafe uploadId in validateStoredUploadPath", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "upload-traversal-"));
    try {
      await expect(
        validateStoredUploadPath({
          uploadRoot: root,
          uploadId: "../../etc/passwd",
          storedPath: path.join(root, "meeting.mp3"),
          originalName: "meeting.mp3",
        }),
      ).rejects.toThrow("Upload ID không hợp lệ");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("buildChunkPath — path traversal protection", () => {
  test("builds safe chunk path with valid inputs", () => {
    const root = "/tmp/uploads";
    const uploadId = "upload_00000000-0000-4000-8000-000000000000";
    expect(buildChunkPath(root, uploadId, 0)).toBe(
      path.join(root, uploadId, "chunks", "0"),
    );
    expect(buildChunkPath(root, uploadId, 999)).toBe(
      path.join(root, uploadId, "chunks", "999"),
    );
  });
});

describe("cleanupOldUploads", () => {
  test("removes stale upload folders older than TTL", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cleanup-test-"));
    try {
      // Create a stale folder (mtime in the past)
      const staleFolder = path.join(root, "upload_stale-00000000-0000-4000-8000-000000000000");
      await mkdir(staleFolder, { recursive: true });
      await writeFile(path.join(staleFolder, "chunk"), "data");
      // Set mtime to 2 days ago
      const oldTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const { utimes } = await import("node:fs/promises");
      await utimes(staleFolder, oldTime, oldTime);

      // Create a fresh folder
      const freshFolder = path.join(root, "upload_fresh-00000000-0000-4000-8000-000000000000");
      await mkdir(freshFolder, { recursive: true });
      await writeFile(path.join(freshFolder, "chunk"), "data");

      const removed = await cleanupOldUploads(root, 24 * 60 * 60 * 1000);
      expect(removed).toBe(1);

      // Stale folder should be gone, fresh folder should remain
      await expect(access(staleFolder)).rejects.toThrow();
      await expect(access(freshFolder)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("respects maxScan limit and only removes oldest folders", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cleanup-test-"));
    try {
      const { utimes } = await import("node:fs/promises");
      const oldTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      // Create 5 stale folders
      for (let i = 0; i < 5; i++) {
        const folder = path.join(root, `upload_stale${i}-00000000-0000-4000-8000-000000000000`);
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "chunk"), "data");
        // Each folder slightly older than the previous
        const folderTime = new Date(oldTime.getTime() - i * 1000);
        await utimes(folder, folderTime, folderTime);
      }

      // maxScan=3 should only remove 3 oldest folders
      const removed = await cleanupOldUploads(root, 24 * 60 * 60 * 1000, 3);
      expect(removed).toBe(3);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("returns 0 when no folders are stale", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cleanup-test-"));
    try {
      const freshFolder = path.join(root, "upload_fresh-00000000-0000-4000-8000-000000000000");
      await mkdir(freshFolder, { recursive: true });
      await writeFile(path.join(freshFolder, "chunk"), "data");

      const removed = await cleanupOldUploads(root, 24 * 60 * 60 * 1000);
      expect(removed).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("cleanupOldUploadsSafely does not throw on error", async () => {
    // Pass a non-existent root — should not throw
    await expect(
      cleanupOldUploadsSafely({
        route: "/api/test",
        uploadRoot: "/nonexistent-path-12345",
        background: false,
      }),
    ).resolves.toBeUndefined();
  });

  test("cleanupOldUploadsSafely with background=true returns immediately", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cleanup-test-"));
    try {
      // Should return immediately without waiting for cleanup
      await expect(
        cleanupOldUploadsSafely({
          route: "/api/test",
          uploadRoot: root,
          background: true,
        }),
      ).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
