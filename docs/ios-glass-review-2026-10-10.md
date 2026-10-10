# Kiểm tra theme iOS Glass — 2026-10-10

Theme khách hàng mới lấy bố cục từ ba ảnh demo đã duyệt: tổng quan sáng/tối, đồng bộ ứng dụng và tài khoản. Mã nguồn React/TypeScript tại `frontend/ios-glass`; bản build tại `public/theme/ios-glass`. Admin và CTV giữ giao diện hiện có.

## Đã kiểm tra

- `npm run build`: TypeScript và Vite build thành công; JS khoảng 380 KB, gzip khoảng 121 KB; font tự lưu trữ, không tải font từ Google.
- `npm test`: 10 kiểm thử qua, gồm tổng upload/download, hết hạn/hết lưu lượng, ngày không giới hạn, tổng hợp hệ số lưu lượng, import URL, header JWT, lỗi mạng/503/403 và phản hồi sai định dạng.
- PHPUnit cách ly: **72 tests, 789 assertions** qua với Laravel 8.83.29/PHP 8.3.33 và SQLite bộ nhớ. Bộ này gồm các hồi quy CTV/Horizon hiện có và hai kiểm thử metadata subscription mới. Có cảnh báo deprecation từ thư viện Laravel cũ và fixture cấu hình trống trong các kiểm thử cũ; không được diễn giải là toàn bộ dự án đã sạch cảnh báo PHP 8.3.
- `tests/ios-glass-theme-smoke.php`: khởi tạo theme lần đầu, ghi cấu hình, cập nhật config trong request, render Blade, escaping tên website và kiểm tra JS/CSS hash trong manifest đều qua. Lệnh cache được mock, không đụng cấu hình website đang chạy.
- Trình duyệt thật tại localhost: desktop/mobile 390×844, trang chủ sáng/tối, profile và hộp đổi giao diện, trang đồng bộ/radio/QR/sao chép, danh mục gói, chu kỳ, coupon sai/đúng, tạo đơn, QR thanh toán mẫu, hủy đơn, tạo/đọc ticket mẫu, danh mục/nội dung hướng dẫn, mất kết nối API, phiên hết hạn và đăng nhập lại, tài khoản chưa có gói.
- Bộ API demo không dùng database và không gửi email/Telegram/thanh toán. Console ở lượt kiểm tra cuối không ghi lỗi JavaScript.

## Sửa trong quá trình kiểm tra

- Native dialog đặt nội dung ở top layer; thông báo bên ngoài bị khuất. Thông báo giờ hiển thị trong hộp thoại, được xóa khi bắt đầu thao tác tiếp theo.
- `@json` dùng biến chuẩn bị trước, tránh lỗi biên dịch khi truyền mảng chứa dấu phẩy trực tiếp trong Blade Laravel 8.
- Khởi tạo theme không lặp vô hạn chờ `config:cache` cập nhật repository của request hiện tại; tạo thư mục config nếu thiếu và publish defaults vào request.
- API subscription bổ sung `profile_name` theo owner CTV hiện tại và chỉ tên gói Staff, giữ nguyên giá và quyền gói ở backend. Kiểm thử chuyển owner/thu hồi vai trò/chưa có gói.
- Lỗi 503/mạng/403 nghiệp vụ giữ phiên; chỉ lỗi xác thực được xác định mới đưa khách về đăng nhập. `verify` dùng một lần, URL callback đơn hàng kiểu cũ vẫn được nhận diện.

## Chưa xác minh trên VPS với theme mới

API và tích hợp thực tế sau khi bật theme, CAPTCHA/email, ticket/Telegram, thanh toán thật, QR trên điện thoại và việc mở các ứng dụng đã cài. Cổng StripeCredit với form nhập thẻ riêng chưa được theme này hỗ trợ. Chưa bật theme trên website test hoặc website chính trong lượt này.

Ảnh demo tạo bằng AI không xác định font/kích thước/chi tiết vector chính xác. Giao diện được đối chiếu trực quan theo bố cục và thiết kế; không tuyên bố trùng tuyệt đối từng pixel ở mọi màn hình.

Hướng dẫn cài và quay về theme cũ: `frontend/ios-glass/README.md`.
