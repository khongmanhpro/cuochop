# Hướng dẫn Backup & Restore cuochop

**Áp dụng:** Single-user deployment (cá nhân)  
**Database:** SQLite (Prisma)  
**Ngày:** 2026-07-07

---

## 1. Export dữ liệu qua app (Khuyến nghị)

Vào **Settings → Account → Backup & Export**:

- **Export JSON**: file `.json` chứa toàn bộ meetings, action items, decisions. Dùng để import lại hoặc phân tích ngoài.
- **Export Markdown**: file `.md` tóm tắt toàn bộ dữ liệu, đọc được ngay, paste vào Obsidian/Notion/chat.

## 2. Backup trực tiếp file SQLite

File database SQLite nằm tại:

```
./prisma/dev.db          (development)
./prisma/prod.db         (production, nếu dùng)
```

### Backup

```bash
# Copy file db
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d)

# Hoặc dùng sqlite3 để backup an toàn (không cần tắt app)
sqlite3 prisma/dev.db ".backup prisma/dev.db.backup-$(date +%Y%m%d)"
```

### Restore

```bash
# Dừng app trước
# Restore từ backup
cp prisma/dev.db.backup-20260707 prisma/dev.db

# Khởi động lại
pnpm dev
```

## 3. Import JSON (nếu cần)

Để import từ file JSON đã export:

1. Vào Settings → Account → Import (nếu có)
2. Chọn file `.json` đã export
3. App validate dữ liệu trước khi ghi DB
4. Không overwrite dữ liệu hiện có — chỉ thêm mới

### Format JSON export

```json
{
  "exportedAt": "2026-07-07T12:00:00.000Z",
  "meetingNotes": [...],
  "actionItems": [...],
  "decisions": [...]
}
```

## 4. Lưu ý

- Backup SQLite là cách nhanh nhất và đầy đủ nhất
- Export JSON hữu ích khi muốn migrate sang instance khác
- Export Markdown hữu ích khi muốn đọc/lưu trữ offline
- Nên backup định kỳ (hàng tuần hoặc trước khi upgrade app)
