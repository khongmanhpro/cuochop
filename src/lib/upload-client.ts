import { readApiError } from "./api-client";

export const CLIENT_CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
export const CLIENT_MAX_UPLOAD_SIZE_BYTES = 1024 * 1024 * 1024;
export const SUPPORTED_UPLOAD_EXTENSIONS = [".mp3", ".mp4", ".wav", ".m4a"];

export type UploadProgress = {
  uploadedChunks: number;
  totalChunks: number;
  percent: number;
};

export type CompleteUploadResponse = {
  ok?: true;
  uploadId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: number;
  totalChunks: number;
};

export function createClientUploadId() {
  const uuid = globalThis.crypto?.randomUUID?.() ?? createFallbackUuid();
  return `upload_${uuid}`;
}

function createFallbackUuid() {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function validateClientFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const isSupported = SUPPORTED_UPLOAD_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );

  if (!isSupported) {
    return "Vui lòng chọn file MP3, MP4, WAV hoặc M4A.";
  }

  if (file.size > CLIENT_MAX_UPLOAD_SIZE_BYTES) {
    return "File vượt quá giới hạn 1GB.";
  }

  return "";
}

export async function uploadFileInChunks({
  file,
  uploadId,
  chunkSizeBytes = CLIENT_CHUNK_SIZE_BYTES,
  onProgress,
}: {
  file: File;
  uploadId: string;
  chunkSizeBytes?: number;
  onProgress: (progress: UploadProgress) => void;
}) {
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSizeBytes));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSizeBytes;
    const end = Math.min(file.size, start + chunkSizeBytes);
    const chunk = file.slice(start, end);

    await uploadChunkWithRetry({
      uploadId,
      chunkIndex,
      totalChunks,
      originalName: file.name,
      chunk,
    });

    const uploadedChunks = chunkIndex + 1;
    onProgress({
      uploadedChunks,
      totalChunks,
      percent: Math.round((uploadedChunks / totalChunks) * 100),
    });
  }

  const response = await fetch("/api/complete-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uploadId,
      originalName: file.name,
      totalChunks,
    }),
  });

  if (!response.ok) {
    throw await readApiError(response, "Hoàn tất upload thất bại.");
  }

  const body = (await response.json()) as CompleteUploadResponse;
  return {
    uploadId: body.uploadId,
    originalName: body.originalName,
    storedPath: body.storedPath,
    sizeBytes: body.sizeBytes,
    totalChunks: body.totalChunks,
  };
}

async function uploadChunkWithRetry({
  uploadId,
  chunkIndex,
  totalChunks,
  originalName,
  chunk,
}: {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  originalName: string;
  chunk: Blob;
}) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append("uploadId", uploadId);
      formData.append("chunkIndex", String(chunkIndex));
      formData.append("totalChunks", String(totalChunks));
      formData.append("originalName", originalName);
      formData.append("chunk", chunk, `${chunkIndex}.part`);

      const response = await fetch("/api/upload-chunk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw await readApiError(response, "Upload chunk thất bại.");
      }

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Upload chunk thất bại.");
}
