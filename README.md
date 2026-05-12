# Vietnamese Meeting Notes Generator

Web app tạo meeting notes tiếng Việt từ file audio/video cuộc họp. MVP hiện tại hỗ trợ upload local theo chunk, Gemini transcription, Gemini notes generation, Copy Markdown và Download `.md`.

## Tính năng MVP

- Upload file `.mp3`, `.mp4`, `.wav`, `.m4a` tối đa 1GB.
- Chia file thành chunk 10MB ở client, lưu tạm local trong `tmp/uploads`.
- Transcribe tiếng Việt bằng Gemini với timestamp và speaker labels tương đối.
- Tạo notes tiếng Việt gồm tóm tắt, overview, nội dung chính, decisions, action items, risks/blockers, open questions và transcript.
- Copy Markdown và download file `.md`.
- Error states có mã lỗi rõ ràng cho upload, transcription và notes generation.

## Requirements

- Node.js tương thích Next.js 16.
- pnpm.
- Gemini API key.

## Install

```bash
pnpm install
```

## Env

Tạo `.env.local`:

```bash
GEMINI_API_KEY=
```

Không commit `.env.local` hoặc secret.

## Run Dev

```bash
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
```

## Test End-to-End

1. Thêm `GEMINI_API_KEY` vào `.env.local`.
2. Restart dev server nếu đang chạy.
3. Mở app ở `http://localhost:3000`.
4. Chọn file MP3/MP4/WAV/M4A tiếng Việt.
5. Chọn transcription model và notes generation model.
6. Bấm `Generate Meeting Notes`.
7. Kiểm tra progress upload, transcription, notes generation.
8. Copy Markdown hoặc download `.md`.

## API

- `POST /api/upload-chunk`: nhận một chunk và lưu vào `tmp/uploads/<uploadId>/chunks/<chunkIndex>`.
- `POST /api/complete-upload`: ghép chunk thành file cuối trong `tmp/uploads/<uploadId>/final/<safeFilename>`.
- `POST /api/transcribe`: gọi Gemini Files API và transcription model.
- `POST /api/generate-notes`: gọi Gemini notes model và trả về notes JSON + Markdown.

## Known Limitations

- Upload local temp không phù hợp production serverless lớn.
- File lớn trong production nên dùng S3/GCS signed URL.
- Speaker labels là tương đối nếu audio không có metadata người nói.
- Gemini JSON có thể cần fallback parser khi model trả text không đúng schema.
- DOCX export chưa được implement.

## Next Steps

- DOCX export.
- Cloud storage.
- Auth/history.
- Background jobs/queue.
