export { defaultModelLabel as defaultModel, modelOptions } from "./models";

export const mockMeetingSections = [
  {
    title: "Tóm tắt điều hành",
    content:
      "Cuộc họp thống nhất ưu tiên hoàn thiện luồng kết nối khách hàng, cải thiện chất lượng dữ liệu đầu vào, và chuẩn bị tài liệu follow-up cho nhóm vận hành.",
  },
  {
    title: "Thông tin cuộc họp",
    content:
      "Chủ đề chính xoay quanh tiến độ triển khai, các phụ thuộc kỹ thuật, và trách nhiệm phối hợp giữa nhóm sản phẩm, kỹ thuật, và kinh doanh.",
  },
  {
    title: "Nội dung chính",
    items: [
      "Nhóm cần rút gọn các bước nhập liệu để giảm thời gian xử lý sau cuộc gọi.",
      "Các trường dữ liệu quan trọng phải được chuẩn hóa trước khi đồng bộ sang hệ thống CRM.",
      "Bản demo nội bộ sẽ tập trung vào các tình huống họp thực tế bằng tiếng Việt.",
    ],
  },
  {
    title: "Quyết định",
    items: [
      "Ưu tiên xuất Markdown trong MVP trước khi thêm DOCX.",
      "Dùng nhãn speaker tương đối nếu không xác định được tên người nói từ transcript.",
    ],
  },
  {
    title: "Action items",
    items: [
      "Product: hoàn thiện checklist nội dung notes trước ngày họp review tiếp theo.",
      "Engineering: chuẩn bị API upload theo chunk ở Phase 2.",
      "Operations: cung cấp thêm 2 file ghi âm mẫu để kiểm tra chất lượng transcript.",
    ],
  },
  {
    title: "Rủi ro / blockers",
    items: [
      "File họp dài có thể mất nhiều thời gian xử lý và cần trạng thái tiến trình rõ ràng.",
      "Speaker labels là tương đối, không nên hiển thị như nhận diện danh tính chắc chắn.",
    ],
  },
  {
    title: "Câu hỏi còn mở",
    items: [
      "Có cần giới hạn thời lượng file ở MVP ngoài giới hạn dung lượng 1GB không?",
      "DOCX export nên dùng template công ty hay format mặc định?",
    ],
  },
] as const;

export const mockTranscript = [
  {
    timestamp: "00:00",
    speaker: "Speaker 1",
    text: "Mình bắt đầu với mục tiêu chính của buổi họp hôm nay là thống nhất phạm vi MVP.",
  },
  {
    timestamp: "02:14",
    speaker: "Speaker 2",
    text: "Phần upload cần hỗ trợ file lớn, nhưng phase đầu tiên chỉ cần mock UI rõ ràng.",
  },
  {
    timestamp: "05:32",
    speaker: "Speaker 1",
    text: "Sau khi có transcript, hệ thống sẽ tạo tóm tắt, quyết định và action items bằng tiếng Việt.",
  },
] as const;

export const mockMarkdown = `# Meeting Notes

## Tóm tắt điều hành
Cuộc họp thống nhất ưu tiên hoàn thiện luồng kết nối khách hàng, cải thiện chất lượng dữ liệu đầu vào, và chuẩn bị tài liệu follow-up cho nhóm vận hành.

## Thông tin cuộc họp
Chủ đề chính xoay quanh tiến độ triển khai, các phụ thuộc kỹ thuật, và trách nhiệm phối hợp giữa nhóm sản phẩm, kỹ thuật, và kinh doanh.

## Nội dung chính
- Nhóm cần rút gọn các bước nhập liệu để giảm thời gian xử lý sau cuộc gọi.
- Các trường dữ liệu quan trọng phải được chuẩn hóa trước khi đồng bộ sang hệ thống CRM.
- Bản demo nội bộ sẽ tập trung vào các tình huống họp thực tế bằng tiếng Việt.

## Quyết định
- Ưu tiên xuất Markdown trong MVP trước khi thêm DOCX.
- Dùng nhãn speaker tương đối nếu không xác định được tên người nói từ transcript.

## Action items
- Product: hoàn thiện checklist nội dung notes trước ngày họp review tiếp theo.
- Engineering: chuẩn bị API upload theo chunk ở Phase 2.
- Operations: cung cấp thêm 2 file ghi âm mẫu để kiểm tra chất lượng transcript.

## Rủi ro / blockers
- File họp dài có thể mất nhiều thời gian xử lý và cần trạng thái tiến trình rõ ràng.
- Speaker labels là tương đối, không nên hiển thị như nhận diện danh tính chắc chắn.

## Câu hỏi còn mở
- Có cần giới hạn thời lượng file ở MVP ngoài giới hạn dung lượng 1GB không?
- DOCX export nên dùng template công ty hay format mặc định?

## Transcript có timestamp
- [00:00] Speaker 1: Mình bắt đầu với mục tiêu chính của buổi họp hôm nay là thống nhất phạm vi MVP.
- [02:14] Speaker 2: Phần upload cần hỗ trợ file lớn, nhưng phase đầu tiên chỉ cần mock UI rõ ràng.
- [05:32] Speaker 1: Sau khi có transcript, hệ thống sẽ tạo tóm tắt, quyết định và action items bằng tiếng Việt.
`;
