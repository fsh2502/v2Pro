# Kiểm tra tên đăng ký có emoji

Tên được báo lỗi trên Hiddify iOS: `🇯🇵SHOPTUANTRUONG🇻🇳`.

## Nguyên nhân và bản sửa

- Hiddify LinkParser đọc `uri.fragment` trực tiếp và dùng làm tên ghi đè, trong khi `queryParameters` đã được giải mã. Đổi liên kết sang `hiddify://import/?url=...&name=...`; từng tham số được mã hóa đúng một lần. Giữ nguyên token và chọn bộ xuất Hiddify. Header Hiddify/Sing-box vốn đã dùng Base64 UTF-8, được giữ nguyên.
- Quantumult X nhận JSON đã URL-encode, nên Unicode trong trường `tag` phải là văn bản, không URL-encode thêm lần nữa. Riêng dấu phẩy và xuống dòng được escape để không chèn thêm tùy chọn/dòng cấu hình; cách ứng dụng hiển thị những dấu phân cách này cần kiểm tra trên thiết bị. Theme mặc định cũng đổi từ `encodeURI` sang `encodeURIComponent` cho JSON để `&`, `#`, `+` không phá tham số.
- Happ, v2RayTun và V2BOX tự dùng `base64:` cho tên Unicode. Tên ASCII thông thường giữ nguyên, tùy chọn ép Base64 vẫn được hỗ trợ. V2BOX dùng `filename*=UTF-8''` thay cho tên UTF-8 trực tiếp trong header.
- Happ/V2BOX giữ giới hạn 25 code point và cắt tại biên cụm ký tự để tránh tách đôi cờ, dấu kết hợp hoặc emoji nối bằng ZWJ.
- Các liên kết đổi tên của theme mặc định mã hóa tên ở query/fragment. Asset mặc định có tham số theo thời gian sửa file; iOS Glass đã build lại với tên asset theo hash.

## Kết quả kiểm thử cục bộ

- PHP cô lập: 102 tests, 1288 assertions, PASS. Các response Hiddify, Sing-box mới/cũ, General, Happ, v2RayTun, V2BOX được giải mã lại để so tên chính xác; kiểm tra header ASCII và tên file UTF-8.
- Frontend: 53 tests, PASS. Kiểm tra tên thực tế, cờ, emoji nhiều code point, tiếng Việt, `&`, `#`, `%`, `+`, dấu nháy; kiểm tra URL/token sau khi parser đọc lại và ngăn chèn tùy chọn qua tên Quantumult X.
- Menu đồng bộ thực tế trong bundle theme mặc định chạy với DOM/platform giả lập: PASS; không mở ứng dụng hoặc tạo yêu cầu mạng.
- TypeScript, build production và cú pháp bundle mặc định: PASS.

## Phạm vi xác minh

Đây là kiểm tra dữ liệu truyền từ panel và hợp đồng parser, chưa chạy ứng dụng Hiddify iOS hoặc từng ứng dụng native trên thiết bị thật. Sau triển khai, nhập một hồ sơ mẫu mới rồi kiểm tra tên; hồ sơ cũ có tên ghi đè lưu trong ứng dụng có thể cần đổi tên hoặc nhập lại. Chỉ cập nhật dữ liệu máy chủ có thể không thay tên ghi đè đã lưu.

Không đổi cấu trúc database, không cần migration, không reset URL/token và không thay cấu hình node.

Tham chiếu chính thức:

- [Hiddify LinkParser](https://github.com/hiddify/hiddify-app/blob/main/lib/utils/link_parsers.dart)
- [Hiddify URL Scheme và Profile-Title](https://github.com/hiddify/hiddify-app/wiki/URL-Scheme)
- [Quantumult X URL Scheme](https://github.com/crossutility/Quantumult-X/blob/master/url-scheme.md)
- [Happ app management](https://github.com/HappDev/happ_su/blob/main/dev-docs/app-management.md)
- [v2RayTun supported headers](https://docs.v2raytun.com/overview/supported-headers)
