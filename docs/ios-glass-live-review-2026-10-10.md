# Kiểm thử iOS Glass trên website test — 2026-10-10

Website: shoptuantruong.cc. Kiểm thử qua trình duyệt, tài khoản khách mẫu đã được duyệt; không dùng API giả trong lượt này.

## Đã xác nhận

- Admin hiển thị danh mục và hộp cài đặt theme sau bản vá `select_options`; kích hoạt iOS Glass thành công, lưu cấu hình hiện có.
- Khách mẫu đăng nhập bằng email/mật khẩu hiện có; tổng quan hiển thị gói 10 GB, 0 GB đã dùng, ngày hết hạn 09/11/2026 khớp dữ liệu Admin.
- Đồng bộ: chọn Hiddify/Sing-box, QR hiển thị, sao chép URL thành công; Sing-box có đúng một tham số `flag=singbox` và tên cấu hình đúng thương hiệu. Chưa mở ứng dụng bên ngoài.
- Danh mục gói, chu kỳ, kiểm tra mã giảm giá sai; đơn mẫu đã hoàn tất và chi tiết đơn 0 CNY, kiểm tra lại trạng thái.
- Danh mục/nội dung hướng dẫn, thông báo và danh sách máy chủ được cấp tải từ API thật.
- Thông tin tài khoản, nhắc hạn/lưu lượng, ví, thẻ quà tặng, lời mời, phiên đăng nhập tải/hiển thị được. Các biểu mẫu đổi mật khẩu, hỗ trợ, đăng ký và quên mật khẩu được mở kiểm tra.
- Giao diện sáng/tối, bố cục điện thoại 390×844 và điều hướng điện thoại; không tràn ngang trang tổng quan. Giao diện đã chọn và phiên khách được giữ sau khi tải lại; đăng xuất về biểu mẫu đăng nhập.

## Hai lỗi phát hiện và đã sửa trong mã nguồn

- API lỗi coupon trả tiếng Anh dù header tiếng Việt: theme chuyển các thông báo coupon đã biết sang tiếng Việt, giữ nguyên phiên đăng nhập. Có kiểm thử hồi quy lỗi `Invalid coupon` (500).
- API trả cờ số 0; React hiển thị `0` khi dùng trực tiếp với `&&` trong biểu mẫu đăng ký/quên mật khẩu. Chuẩn hóa cờ xác minh và CAPTCHA sang boolean.

Build TypeScript/Vite và 11 kiểm thử frontend đã qua sau hai sửa đổi. Website cần tải commit chứa hai sửa đổi để áp dụng; không coi bản đang chạy trước khi cập nhật là đã kiểm thử hai bản vá này.

## Phạm vi chưa kiểm thử giao dịch

Không tạo thêm đơn, không thanh toán thật/nạp tiền/đổi thẻ, không gửi ticket/email/Telegram, không đăng ký tài khoản, không đổi mật khẩu hay đặt lại token/URL, không kết thúc các phiên khác. Chỉ kiểm tra biểu mẫu với các chức năng này. Chưa kiểm thử CAPTCHA thực tế, import trên ứng dụng đã cài, StripeCredit hoặc kết nối node thực tế. Đây là kiểm thử tích hợp các luồng nêu trên, không phải cam kết mọi chức năng sẽ không có lỗi.

Ảnh bằng chứng lưu cục bộ tại `artifacts/ios-glass-live-20261010`; không đưa URL subscription, mã xác thực hoặc thông tin phiên vào báo cáo/repo.
