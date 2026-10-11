# Mail v2 — Apple Minimal

Thiết kế lại bộ `resources/views/mail/mail v2` theo bản demo: nền xanh nhạt, thẻ trắng bo góc, icon riêng, mã xác minh lớn, nút xanh và chân thư thống nhất. Cả 5 template sử dụng `layout.blade.php`; các template `default` và `classic` được giữ nguyên.

## Nội dung và dữ liệu

- `verify`: giữ nguyên 6 chữ số để sao chép không bị thêm dấu cách, thông báo hiệu lực 5 phút như TTL của API.
- `mailLogin`: nút chính và liên kết dự phòng dùng đúng biến `link`. Đây là template có sẵn, không bổ sung API đăng nhập bằng email mới.
- `notify`: hiển thị nội dung văn bản và xuống dòng; escape HTML thay vì thực thi markup từ nội dung ticket hoặc biểu mẫu gửi thư.
- `remindExpire`: lấy tên gói, thời điểm hết hạn và múi giờ của ứng dụng. Gói CTV ưu tiên tên gói riêng và dẫn tới hỗ trợ để gia hạn; gói chính dẫn tới danh mục gói.
- `remindTraffic`: tổng upload + download, tổng hạn mức, phần còn lại và tỷ lệ sử dụng thực tế. GB dùng cùng đơn vị 1,073,741,824 byte với panel.

Payload nhắc nhở cũ chỉ có `name`/`url` vẫn render được; không tự điền số liệu hoặc ngày tháng giả. Tên thương hiệu là dữ liệu động, hỗ trợ emoji. Điều kiện gửi email, cấu hình SMTP và giới hạn nhắc lưu lượng 24 giờ giữ nguyên.

## Hiển thị và liên kết

Bố cục dùng bảng và phần lớn CSS inline. Icon email dùng PNG trong `public/assets/mail-v2`; SVG tương ứng được giữ làm nguồn chỉnh sửa. Icon chỉ mang tính trang trí, không chứa thông tin thiết yếu. Thông tin, mã và nút vẫn đọc được khi ứng dụng email chặn ảnh.

Liên kết website/assets lấy từ URL website đã cấu hình; chỉ chấp nhận HTTP/HTTPS. Đường dẫn tài khoản/gói/hỗ trợ theo theme đang dùng: iOS Glass dùng `profile`/`plans`/`support`, theme gốc dùng `profile`/`plan`/`ticket`.

## Triển khai

Trong checkout website đang dùng nhánh `Max`:

```bash
(
set -eu
cd /www/wwwroot/v2pro-max
git pull --ff-only origin Max
runuser -u www -- /www/server/php/83/bin/php artisan view:clear
/etc/init.d/php-fpm-83 reload
runuser -u www -- /www/server/php/83/bin/php artisan horizon:terminate
)
```

Supervisor phải có `autorestart=true` để khởi động lại Horizon sau khi worker hoàn tất công việc đang chạy. Không cần Composer install, migration hay bật bảo trì cho thay đổi này. Chọn mẫu `mail v2` trong cấu hình email của Admin nếu website đang dùng mẫu khác.

## Kiểm tra

PHPUnit kiểm tra cả 5 template với payload mới/cũ, emoji, escape nội dung, URL không hợp lệ, dữ liệu gói CTV/gói chính, tính lưu lượng, điều kiện nhắc nhở và giới hạn gửi. Job gửi thư được thực thi bằng transport array cô lập; không kết nối SMTP.

Preview HTML được chụp bằng Edge headless với dữ liệu mẫu; cả 5 mẫu không tràn ngang ở 390px và kiểm tra bổ sung ở 320px. Đây là kiểm tra trình duyệt, chưa phải xác nhận hiển thị trên ứng dụng Gmail, Outlook hoặc Apple Mail thực tế. Trước khi dùng rộng rãi, gửi thư thử từ Admin tới hộp thư kiểm thử của bạn.
