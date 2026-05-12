import { afterEach, describe, expect, test, vi } from "vitest";
import { uploadFileInChunks } from "./upload-client";

describe("upload client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uploads file slices and reports chunk progress", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ received: true }))
      .mockResolvedValueOnce(Response.json({ received: true }))
      .mockResolvedValueOnce(Response.json({ received: true }))
      .mockResolvedValueOnce(
        Response.json({
          uploadId: "upload_00000000-0000-4000-8000-000000000000",
          originalName: "meeting.mp3",
          storedPath: "/tmp/uploads/meeting.mp3",
          sizeBytes: 10,
          totalChunks: 3,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const progress: string[] = [];
    const result = await uploadFileInChunks({
      file: new File(["0123456789"], "meeting.mp3"),
      uploadId: "upload_00000000-0000-4000-8000-000000000000",
      chunkSizeBytes: 4,
      onProgress: (state) => {
        progress.push(
          `${state.percent}% (${state.uploadedChunks}/${state.totalChunks})`,
        );
      },
    });

    expect(progress).toEqual(["33% (1/3)", "67% (2/3)", "100% (3/3)"]);
    expect(result.totalChunks).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/upload-chunk");
    expect(fetchMock.mock.calls[3]?.[0]).toBe("/api/complete-upload");
  });

  test("retries a failed chunk twice before continuing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "temporary" }, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ received: true }))
      .mockResolvedValueOnce(
        Response.json({
          uploadId: "upload_00000000-0000-4000-8000-000000000000",
          originalName: "meeting.wav",
          storedPath: "/tmp/uploads/meeting.wav",
          sizeBytes: 4,
          totalChunks: 1,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await uploadFileInChunks({
      file: new File(["data"], "meeting.wav"),
      uploadId: "upload_00000000-0000-4000-8000-000000000000",
      chunkSizeBytes: 10,
      onProgress: () => undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
