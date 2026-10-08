# Bản test CTV / Staff

Nhánh: `test/ctv-20261008`. Dùng để kiểm thử trên website riêng trong aaPanel/BaoTa.
Đây là mã Laravel thật; trang `admin-demo` trong công cụ preview chỉ là mock và không phải đường dẫn của website triển khai.

## Lấy mã nguồn

```bash
git clone --branch test/ctv-20261008 --single-branch https://github.com/fsh2502/v2Pro.git /www/wwwroot/v2pro-test
```

Thư mục đích phải chưa tồn tại. Nếu aaPanel đã tạo thư mục website, có thể tải ZIP của nhánh rồi giải nén nội dung dự án vào thư mục đó:

[Tải ZIP nhánh test](https://github.com/fsh2502/v2Pro/archive/refs/heads/test/ctv-20261008.zip)

Sau khi giải nén, `artisan`, `composer.json` và thư mục `public` phải nằm trực tiếp trong thư mục dự án, không bị lồng thêm một cấp `v2Pro-test-ctv-20261008`.
ZIP không có thông tin Git; không dùng `update.sh` với bản tải ZIP.

## Trạng thái bản test

- Có phân quyền Staff theo khách do mình tạo, hạn mức, mã nhận diện, appName cá nhân, gói Staff được Admin cấp, Quản Lý CTV và lịch sử thao tác.
- Có các sửa lỗi trong [báo cáo rà soát](docs/deployment-review-2026-10-08.md).
- **Chưa có `composer.lock` đã kiểm thử và không kèm `vendor`.** Clone/tải ZIP chưa đủ để chạy PHP; cần chốt dependency theo phiên bản PHP của VPS trước khi cài đặt. Không sao chép `vendor` từ máy Windows lên VPS.
- Chưa kiểm thử MySQL, Redis và Horizon thực tế. Chưa kết luận sẵn sàng production.

Chi tiết quyền và cách hoạt động: [Staff / CTV](docs/staff-ownership.md).

## Chuẩn bị aaPanel

1. Tạo tên miền test và thư mục riêng; tạo database MySQL **trống**, user riêng. Không dùng database của website đang hoạt động.
2. Xác nhận phiên bản PHP của website và PHP CLI. Cài MySQL/Redis và các extension cần thiết cho Laravel, bao gồm PDO MySQL, mbstring, OpenSSL, cURL, XML, BCMath và Redis. Horizon chạy bằng PHP CLI trên Linux cần pcntl/posix.
3. Đặt **Running directory** là `/public`, bật SSL. Nếu dùng Nginx, đặt URL rewrite:

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

4. Cho user chạy PHP quyền ghi `storage` và `bootstrap/cache`; CLI cài đặt cũng cần quyền tạo `.env` tại thư mục dự án. Cấu hình open_basedir cho phép PHP đọc toàn bộ thư mục dự án và thư mục tạm cần thiết.
5. Trước bước cài đặt tiếp theo, cần xác nhận phiên bản PHP và hoàn tất dependency. Với lock file đã kiểm thử, chạy Composer bằng đúng PHP CLI của website:

```bash
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-scripts
composer check-platform-reqs --no-dev
composer audit --no-dev
```

Đoạn trên chỉ áp dụng **khi đã có lock file**. Nếu chưa có lock, Composer sẽ giải phiên bản mới; chưa có bảo đảm tương thích. Không bỏ qua lỗi platform/audit để triển khai.
`--no-scripts` trì hoãn việc khởi động Artisan tới sau khi cấu hình môi trường đúng.

## Cài mới trên database test trống

Chỉ làm bước này sau khi dependency đã sẵn sàng. Installer nhập `database/install.sql`, có thể xóa bảng cùng tên nếu database đã có dữ liệu.

**Không tạo `.env` trước khi chạy `v2board:install`: lệnh này tự tạo `.env` và từ chối nếu file đã tồn tại.**

Trước khi cài, sửa `.env.example` của bản test với tên miền test và cấu hình Redis riêng. Ví dụ sau chỉ minh họa; database Redis 2/3 phải chưa được website khác sử dụng:

```dotenv
APP_NAME=V2ProTest
APP_ENV=production
APP_DEBUG=false
APP_URL=https://test.example.com
REDIS_DB=2
REDIS_CACHE_DB=3
REDIS_PREFIX=v2pro_test_database_
CACHE_PREFIX=v2pro_test_cache_
HORIZON_PREFIX=v2pro_test_horizon:
HORIZON_MAX_PROCESSES=2
```

Thiết lập host/port/password Redis đúng VPS. Dùng Redis instance riêng nếu chưa chắc các database nào đang được dùng; không chạy lệnh xóa cache trên Redis dùng chung với website thật.

Trong thư mục dự án, dùng đúng PHP CLI của website để chạy:

```bash
php artisan v2board:install
php artisan migrate --force
php artisan optimize:clear
php artisan package:discover --ansi
php artisan config:cache
php artisan view:cache
```

Installer hỏi thông tin database và email Admin, rồi in mật khẩu cùng đường dẫn Admin. Lưu lại tại máy chủ; không đăng thông tin này lên GitHub.
Trang Staff thật nằm tại `https://ten-mien-test/staff`. Đường dẫn Admin là đường dẫn được installer in ra, không phải `/admin-demo`.

Nếu `php artisan migrate:status` báo `Migration table not found`, database chưa có bảng theo dõi migration. Bản cài từ SQL có thể vẫn có các bảng ứng dụng và CTV. Nhánh test đã xử lý việc bảng `failed_jobs` tồn tại trước đó; dùng bản nhánh mới nhất, chạy `php artisan migrate --force`, rồi kiểm tra lại `php artisan migrate:status`. Không dùng `migrate:fresh` hoặc `migrate:refresh` cho database đang có dữ liệu cần giữ.

Nếu cài thất bại, giữ lại lỗi để xử lý trước khi chạy lại; không xóa `.env` rồi chạy lại installer trên database có dữ liệu cần giữ.

## Nếu dùng bản sao database hiện có

Đây là luồng khác với cài mới. Sao lưu database trước, khôi phục vào database test riêng, cấu hình `.env` và `config/v2board.php` của bản test (không đưa hai file này lên Git). Giữ APP_KEY tương thích bản sao, đổi domain/cấu hình Redis sang test, vô hiệu tích hợp thanh toán, email và Telegram thật trước khi chạy worker/scheduler.

**Không chạy `v2board:install` hoặc nhập toàn bộ `database/update.sql` trên bản sao có dữ liệu.** Sau khi xác nhận schema nền tương thích, chỉ áp dụng migration bổ sung:

```bash
php artisan migrate --force
php artisan optimize:clear
php artisan package:discover --ansi
php artisan config:cache
php artisan view:cache
```

## Worker, scheduler và kiểm thử

Sau khi đã cách ly tích hợp của website test, dùng Supervisor/Process Manager để giữ `php artisan horizon` chạy với đúng PHP CLI và user có quyền ghi. Đặt cron mỗi phút cho `php artisan schedule:run`, đường dẫn tuyệt đối tới PHP và `artisan` của site test. Không dùng cấu hình worker/cron của site thật.

Kiểm thử tối thiểu:

- Admin bật Staff tại Người dùng; thiết lập hạn mức và quyền gói trong Quản Lý CTV.
- Hai Staff tạo khách riêng, không xem/sửa được khách của nhau; khách bị khóa/hết hạn vẫn tính hạn mức.
- Tạo vượt hạn mức bị chặn, kể cả hai yêu cầu đồng thời khi chỉ còn một chỗ.
- Chỉ chọn được gói Staff đang được cấp, thu hồi quyền/gói có hiệu lực tại backend.
- Đổi appName, nhập emoji, kiểm tra subscription bằng tài khoản/node test.
- Sửa khách, reset UUID và xóa khách được ghi lịch sử; không lộ mật khẩu/token trong nhật ký.
- Khóa/thu hồi quyền Staff hoặc Admin có hiệu lực với phiên đăng nhập đang tồn tại.
- Kiểm tra MySQL migrations, Redis, queue, cron và log PHP/Laravel trên VPS.

## Nguồn hướng dẫn

- [aaPanel: PHP Project, Running directory, PHP CLI và URL rewrite](https://www.aapanel.com/docs/Function/php.html)
- [Laravel 8: Deployment](https://laravel.com/framework/docs/8.x/deployment)
- [Composer: cài từ lock file](https://getcomposer.org/doc/01-basic-usage.md#installing-from-composer-lock)

Nhánh test không thay đổi `main` hoặc nhánh backup code gốc. Backup code không thay thế backup database.
