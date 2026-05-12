import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { appApiError } from "./api-errors";

export const CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024 * 1024;
export const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const UPLOAD_ROOT = path.join(process.cwd(), "tmp", "uploads");

const supportedExtensions = new Set(["mp3", "mp4", "wav", "m4a"]);

export type UploadCompleteResult = {
  uploadId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: number;
  totalChunks: number;
};

export type ValidationResult =
  | { ok: true; extension: string }
  | { ok: false; error: string };

export function createUploadId() {
  return `upload_${randomUUID()}`;
}

export function isSafeUploadId(uploadId: string) {
  return /^upload_[a-f0-9-]{36}$/i.test(uploadId);
}

export function sanitizeFilename(filename: string) {
  const baseName = path.basename(filename).trim();
  const sanitized = baseName.replace(/[^\w.-]+/g, "_");
  return sanitized || "upload.bin";
}

export function validateMediaFilename(filename: string): ValidationResult {
  const extension = path.extname(filename).slice(1).toLowerCase();

  if (!supportedExtensions.has(extension)) {
    return {
      ok: false,
      error: "Unsupported file format. Use MP3, MP4, WAV, or M4A.",
    };
  }

  return { ok: true, extension };
}

export function buildChunkPath(
  uploadRoot: string,
  uploadId: string,
  chunkIndex: number,
) {
  return path.join(uploadRoot, uploadId, "chunks", String(chunkIndex));
}

export function buildFinalPath(
  uploadRoot: string,
  uploadId: string,
  originalName: string,
) {
  return path.join(uploadRoot, uploadId, "final", sanitizeFilename(originalName));
}

export async function validateStoredUploadPath({
  uploadRoot = UPLOAD_ROOT,
  uploadId,
  storedPath,
  originalName,
}: {
  uploadRoot?: string;
  uploadId: string;
  storedPath: string;
  originalName: string;
}) {
  assertSafeUploadId(uploadId);

  const validation = validateMediaFilename(originalName);
  if (!validation.ok) {
    throw appApiError(
      "INVALID_FILE_TYPE",
      "Định dạng file không hợp lệ. Vui lòng dùng MP3, MP4, WAV hoặc M4A.",
      400,
      validation.error,
    );
  }

  const resolvedUploadFolder = path.resolve(uploadRoot, uploadId, "final");
  const resolvedStoredPath = path.resolve(storedPath);
  const expectedFilename = sanitizeFilename(originalName);

  if (
    resolvedStoredPath !== path.join(resolvedUploadFolder, expectedFilename)
  ) {
    throw appApiError(
      "INVALID_UPLOAD_PATH",
      "Đường dẫn file upload không hợp lệ.",
      400,
      "Stored file path is outside the upload folder.",
    );
  }

  const storedValidation = validateMediaFilename(resolvedStoredPath);
  if (!storedValidation.ok) {
    throw appApiError(
      "INVALID_FILE_TYPE",
      "Định dạng file không hợp lệ. Vui lòng dùng MP3, MP4, WAV hoặc M4A.",
      400,
      storedValidation.error,
    );
  }

  await access(resolvedStoredPath);
  return resolvedStoredPath;
}

export async function cleanupOldUploads(
  uploadRoot = UPLOAD_ROOT,
  olderThanMs = UPLOAD_TTL_MS,
) {
  await mkdir(uploadRoot, { recursive: true });

  const entries = await readdir(uploadRoot, { withFileTypes: true });
  const cutoff = Date.now() - olderThanMs;

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const folderPath = path.join(uploadRoot, entry.name);
        const folderStat = await stat(folderPath);

        if (folderStat.mtimeMs < cutoff) {
          await rm(folderPath, { recursive: true, force: true });
        }
      }),
  );
}

export async function cleanupOldUploadsSafely({
  route,
  uploadId,
  uploadRoot = UPLOAD_ROOT,
}: {
  route: string;
  uploadId?: string;
  uploadRoot?: string;
}) {
  try {
    await cleanupOldUploads(uploadRoot);
  } catch (error) {
    console.warn(
      `[cleanup-warning] route=${route} uploadId=${uploadId || "-"} message=${
        error instanceof Error ? error.message : "cleanup failed"
      }`,
    );
  }
}

export async function saveChunk({
  uploadRoot = UPLOAD_ROOT,
  uploadId,
  chunkIndex,
  chunk,
}: {
  uploadRoot?: string;
  uploadId: string;
  chunkIndex: number;
  chunk: File;
}) {
  assertSafeUploadId(uploadId);
  assertValidChunkIndex(chunkIndex);

  const chunkDirectory = path.join(uploadRoot, uploadId, "chunks");
  await mkdir(chunkDirectory, { recursive: true });
  await writeFile(
    buildChunkPath(uploadRoot, uploadId, chunkIndex),
    Buffer.from(await chunk.arrayBuffer()),
  );
}

export async function mergeChunksToFinalFile({
  uploadRoot = UPLOAD_ROOT,
  uploadId,
  originalName,
  totalChunks,
  maxSizeBytes = MAX_UPLOAD_SIZE_BYTES,
}: {
  uploadRoot?: string;
  uploadId: string;
  originalName: string;
  totalChunks: number;
  maxSizeBytes?: number;
}): Promise<UploadCompleteResult> {
  assertSafeUploadId(uploadId);
  assertValidTotalChunks(totalChunks);

  const validation = validateMediaFilename(originalName);
  if (!validation.ok) {
    throw appApiError(
      "INVALID_FILE_TYPE",
      "Định dạng file không hợp lệ. Vui lòng dùng MP3, MP4, WAV hoặc M4A.",
      400,
      validation.error,
    );
  }

  let sizeBytes = 0;
  const chunkPaths: string[] = [];

  for (let index = 0; index < totalChunks; index += 1) {
    const chunkPath = buildChunkPath(uploadRoot, uploadId, index);
    const chunkStat = await stat(chunkPath).catch(() => undefined);

    if (!chunkStat) {
      throw appApiError(
        "COMPLETE_UPLOAD_FAILED",
        "Upload chưa đầy đủ chunk. Vui lòng thử lại.",
        400,
        `Missing chunk ${index}.`,
      );
    }

    sizeBytes += chunkStat.size;
    if (sizeBytes > maxSizeBytes) {
      throw appApiError(
        "FILE_TOO_LARGE",
        "File vượt quá giới hạn 1GB.",
        400,
        "File is larger than the 1GB limit.",
      );
    }

    chunkPaths.push(chunkPath);
  }

  const finalPath = buildFinalPath(uploadRoot, uploadId, originalName);
  await mkdir(path.dirname(finalPath), { recursive: true });

  const output = createWriteStream(finalPath);

  try {
    for (const chunkPath of chunkPaths) {
      await pipeline(createReadStream(chunkPath), output, { end: false });
    }
  } finally {
    output.end();
  }

  return {
    uploadId,
    originalName,
    storedPath: finalPath,
    sizeBytes,
    totalChunks,
  };
}

export function parseRequiredString(value: FormDataEntryValue | null, name: string) {
  if (typeof value !== "string" || value.length === 0) {
    if (name === "uploadId") {
      throw appApiError(
        "MISSING_UPLOAD_ID",
        "Upload ID không hợp lệ hoặc bị thiếu.",
        400,
        "Missing uploadId.",
      );
    }

    if (name === "storedPath") {
      throw appApiError(
        "INVALID_UPLOAD_PATH",
        "Đường dẫn file upload không hợp lệ.",
        400,
        "Missing storedPath.",
      );
    }

    throw appApiError("INTERNAL_ERROR", `Missing ${name}.`, 400);
  }

  return value;
}

export function parseRequiredInteger(
  value: FormDataEntryValue | string | null,
  name: string,
) {
  const rawValue = typeof value === "string" ? value : undefined;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (!Number.isInteger(parsed)) {
    throw appApiError(
      name === "chunkIndex" ? "CHUNK_UPLOAD_FAILED" : "COMPLETE_UPLOAD_FAILED",
      `${name} không hợp lệ.`,
      400,
      `Invalid ${name}.`,
    );
  }

  return parsed;
}

function assertSafeUploadId(uploadId: string) {
  if (!isSafeUploadId(uploadId)) {
    throw appApiError(
      "MISSING_UPLOAD_ID",
      "Upload ID không hợp lệ hoặc bị thiếu.",
      400,
      "Invalid uploadId.",
    );
  }
}

function assertValidChunkIndex(chunkIndex: number) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw appApiError(
      "CHUNK_UPLOAD_FAILED",
      "Chunk index không hợp lệ.",
      400,
      "Invalid chunkIndex.",
    );
  }
}

function assertValidTotalChunks(totalChunks: number) {
  if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
    throw appApiError(
      "COMPLETE_UPLOAD_FAILED",
      "Tổng số chunk không hợp lệ.",
      400,
      "Invalid totalChunks.",
    );
  }
}
