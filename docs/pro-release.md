# Chuẩn bị phát hành Pro

Nhánh Max (trước đây tên Pro) kế thừa bản Laravel 12 tại `80b9e154`. Chỉ bộ xem phim `public/xem-phim` được gỡ theo lựa chọn của chủ repo. Các module độc lập, SQL cũ và file phát triển còn lại được giữ trong Git.

## Phạm vi hỗ trợ triển khai

Hướng dẫn chính dùng Linux, Nginx, PHP-FPM 8.3, MySQL/MariaDB và Redis/Horizon. Webman/Workerman, Cloudflare worker và script chỉnh kernel được giữ để tương thích mã nguồn; không nằm trong cấu hình dependency/runtime đã kiểm thử của Pro. Không tự chạy các script này khi cài đặt hoặc nâng cấp theo README. Muốn sử dụng cần kiểm thử và quản lý dependency/cấu hình riêng.

`public/check_user.php` là endpoint tương thích cho worker, đọc token và database trực tiếp. Endpoint này không đi qua middleware Laravel; cần coi token là bí mật, kiểm tra cấu hình và áp dụng hạn mức yêu cầu tại Nginx/Cloudflare nếu dùng. `worker.js` có cấu hình mật khẩu riêng; không triển khai giá trị mặc định. `database/update.sql` được giữ làm tài liệu tương thích, không còn được lệnh `v2board:update` thực thi.

## Kiểm tra trước khi mở bán

- Chốt commit phát hành, lưu bản sao source và database; thử khôi phục sang staging riêng.
- Cài từ lock, chạy Composer platform/audit; không dùng lock/vendor cũ và không bỏ qua cảnh báo audit để tiếp tục cài.
- Chạy PHPUnit, kiểm tra bootstrap/router, hồi quy Admin/CTV và frontend. CI có database MySQL riêng để kiểm tra nâng cấp và chạy lại không mất dữ liệu mẫu.
- Kiểm tra Admin đăng nhập/reload, khách đăng nhập, hạn mức CTV, truy cập chéo CTV, cấp/thu hồi gói, chuyển khách, nhật ký và Unicode trên staging.
- Kiểm tra gói/giá/đơn hàng, callback thanh toán và hoàn tiền với cấu hình nhà cung cấp của bạn. Kiểm tra link/QR/đặt lại URL trong các ứng dụng thực tế và node đang dùng.
- Kiểm tra SMTP, Telegram, hàng đợi, scheduler, backup tự động, HTTPS, Redis cách ly và quyền file. Bật tích hợp thật sau khi xác minh người nhận/môi trường.
- Đặt thương hiệu, nội dung hỗ trợ, điều khoản dịch vụ và chính sách dữ liệu. Giữ LICENSE và thông báo thành phần khi phân phối; xác nhận quyền với artwork/icon.

CI và bộ test cô lập không kiểm tra thanh toán thật, gửi email thật hoặc mọi tổ hợp node/ứng dụng. Bản Pro không cung cấp hệ thống license trả phí hay bảo đảm không có lỗi. Những tích hợp này phải được nghiệm thu theo cấu hình triển khai.

## Cập nhật và quay lại

Luôn dùng release mới, giữ APP_KEY, `.env` và cấu hình khách hàng. Lệnh chuyển đổi database chỉ thêm cấu trúc thiếu và chạy migration; DDL MySQL có thể tự commit. Dừng nhận ghi, Horizon và cron trước khi chuyển. Nginx, worker và scheduler phải dùng cùng release. Khi cần quay lại, dừng ghi trước; kiểm tra tương thích hoặc khôi phục backup có kiểm soát, tránh mất dữ liệu mới.

Các báo cáo kiểm thử cũ trong `docs/` và `README-TEST.md` chỉ phản ánh commit/môi trường ghi trong từng tài liệu. Không coi chúng là kết quả kiểm thử của một lần triển khai mới.
