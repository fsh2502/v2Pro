# Nâng Laravel 12 trước khi đưa CTV lên website chính

Nhánh `codex/laravel12-security`, dựa trên bản CTV/iOS Glass `a4f8fd0616aad1f67532d3db6f4d8688c59576a7`. Bản nâng cấp này có dependency riêng được cố định trong Git. Không ghi đè bản đang chạy ở `/www/wwwroot/v2Pro` và không dùng lock ứng viên đã sửa tại `/www/wwwroot/v2pro-release-20261011`.

## Dependency và thay đổi tương thích

| Thành phần | Phiên bản trong lock |
| --- | --- |
| Laravel | 12.69.3 |
| Horizon | 5.50.0 |
| firebase/php-jwt | 7.2.1 |
| Flysystem | 3.36.0 |
| Symfony Mailer | 7.4.19 |
| Symfony Mailgun / Postmark bridge | 7.4.18 |
| Symfony YAML | 7.4.20 |
| Monolog | 3.12.1 |
| Carbon | 3.14.2 |
| PHPUnit | 11.5.57 |

Manifest dùng phiên bản stable và platform PHP 8.3.30, phù hợp PHP CLI đã xác nhận trên VPS chính. Nên dùng PHP 8.3.30 trở lên; PHP-FPM của website và CLI/worker cần dùng cùng bộ extension.

- Thay Fideloper middleware bằng TrustProxies của Laravel; chuyển middleware maintenance sang lớp hiện hành.
- Thay Swiftmailer bằng cấu hình mailers/Symfony Mailer. Giữ hỗ trợ `MAIL_DRIVER`, bổ sung `MAIL_MAILER`; kèm bridge Mailgun/Postmark để giữ các driver cũ. Thiết lập SMTP của panel được ánh xạ vào mailer mới; TLS yêu cầu STARTTLS, SSL dùng socket mã hóa. Xóa mailer đã cache giữa các job. Khi thay đổi cấu hình trên Admin, khởi động lại Horizon để worker đọc file config mới.
- Cập nhật database logger cho Monolog 3; giữ kênh MySQL như bản trước và loại password/token khỏi dữ liệu request ghi log.
- Sửa lệnh SQL cập nhật để dùng `DB::statement` thay vì truyền Query Expression cho `select`.
- Sửa đường xử lý ViewException để trả HTTP 500 hợp lệ, và xử lý header/URL subscription trống trên PHP 8.3.
- Cập nhật PHPUnit 11 và bỏ hook PHPUnit cũ. PHPUnit mặc định chạy cùng bộ kiểm thử cô lập với `phpunit.isolated.xml`; hai ExampleTest mẫu không nằm trong bộ này.
- `init.sh` cài từ lock, không tự `require` Adapterman. `update.sh` chặn nâng framework tại chỗ nếu vendor còn Laravel đời cũ. Việc chuyển từ website gốc phải dùng quy trình release riêng bên dưới.

Giữ nguyên APP_KEY, cách ký HS256, cấu trúc session và Redis prefix của website chính khi chuyển production. Không chạy `key:generate` trên bản nâng cấp. JWT 7 yêu cầu khóa HS256 đủ dài; preflight phải xác nhận chuỗi `config('app.key')` hiện có ít nhất 32 byte, không in giá trị khóa ra ngoài. Trên staging, dùng cùng APP_KEY để kiểm tra tương thích dữ liệu nhưng Redis/database phải cách ly.

Không thêm Adapterman/Workerman vào lock này. Runtime được chuẩn bị cho aaPanel Nginx + PHP-FPM + Horizon CLI; đường chạy `webman.php` vẫn là tùy chọn chưa được xác minh trên Laravel 12. Không chạy `composer require` tự động trên máy production.

## Bằng chứng kiểm thử ngày 11/10/2026

Dùng vendor cài từ chính lock này, không mượn vendor Laravel cũ:

- Composer validate strict và autoload strict PSR: qua.
- Composer audit toàn bộ lock, gồm cả dev: `advisories: []`, `abandoned: []`, `filter: []`. Không bỏ qua advisory bảo mật.
- PHPUnit: **80 test, 824 assertion**, không warning/deprecation. Các transport SMTP/Mailgun/Postmark được dựng mà không kết nối ra ngoài; job email được thử với transport array.
- Bootstrap thực của ứng dụng: **213 route**, kiểm tra controller, package discovery, render Staff/Admin; HTTP kernel kiểm tra guest config, validation, login, guest bị chặn, Admin bị khóa và Horizon JWT cold/warm.
- Bảy migration được chạy hai lần trên SQLite cô lập, giữ tài khoản và failed job cũ.
- Theme iOS Glass: khởi tạo, Blade escaping, manifest JS/CSS qua. Sáu nhóm subscription/TLS/REALITY/certificate qua; riêng certificate có 76 kiểm tra.
- Sáu script JavaScript hồi quy Admin/CTV/Staff/QR/bản dịch qua.
- Kiểm tra cú pháp 287 file PHP qua tại thời điểm kiểm thử.

Môi trường local: Windows, PHP 8.3.33, SQLite/cache array, mail transport array. Chỉ khi tạo vendor local đã bỏ kiểm tra ext-pcntl/ext-posix do Windows; **không dùng các cờ bỏ qua platform trên VPS Linux**. Audit không bỏ qua lỗ hổng. Kết quả audit là tại thời điểm kiểm tra, không bảo đảm không có advisory mới hoặc lỗi trong mã nghiệp vụ.

Chưa chạy bản Laravel 12 này trên MySQL/Redis/Horizon thực, chưa thử SMTP hay thanh toán thật. Kết quả kiểm thử website trước đây thuộc bản Laravel cũ, không thay thế kiểm thử staging của nhánh này. Chỉ chuyển production sau các bước bên dưới.

## Chuẩn bị mã và dependency trên VPS, chưa động tới website chính

Dùng thư mục mới; không sao chép lock/vendor cũ sang. Lệnh sau chỉ clone và cài dependency, không migrate, không chạy worker:

```bash
(
set -eu
framework_dir=/www/wwwroot/v2pro-laravel12-check-20261011
deploy_php=/www/server/php/83/bin/php
deploy_composer=/www/wwwroot/v2Pro/composer.phar

if [ -e "$framework_dir" ]; then
    printf 'Thư mục đã tồn tại: %s. Dừng để kiểm tra.\n' "$framework_dir"
    exit 1
fi
git clone --branch codex/laravel12-security --single-branch \
    https://github.com/fsh2502/v2Pro.git "$framework_dir"
cd "$framework_dir"
git rev-parse HEAD
"$deploy_php" -v
"$deploy_php" "$deploy_composer" --no-plugins --no-interaction validate --strict --no-check-publish
"$deploy_php" "$deploy_composer" --no-plugins --no-interaction audit --locked --no-dev
"$deploy_php" "$deploy_composer" --no-plugins --no-interaction install \
    --no-dev --prefer-dist --optimize-autoloader --no-scripts
"$deploy_php" "$deploy_composer" --no-plugins --no-interaction check-platform-reqs --no-dev
)
```

Nếu lỗi platform/audit, dừng xử lý trước. Không chạy `composer update`, không tắt audit hoặc dùng `--ignore-platform-reqs` để vượt lỗi. Ghi lại commit và hash lock dùng trên staging; production sau này cài đúng commit/lock đã kiểm thử.

PHP cần các extension của Laravel và PDO MySQL. Với cấu hình Redis client `phpredis`, phải có ext-redis; Horizon cần pcntl/posix ở PHP CLI Linux. Platform check của Composer không thay thế kiểm tra Redis/PDO theo cấu hình ứng dụng. PHPUnit/smoke database cô lập cần PDO SQLite và dependency dev; có thể cài dev từ cùng lock trong checkout kiểm thử ngoài document root, không để dependency dev trên release production.

## Dựng staging với bản sao database

1. Sao lưu mã nguồn, `.env`, `config/v2board.php`, `config/theme`, storage và database chính. Thử khôi phục dump vào **database staging mới**. Bản backup code trên GitHub không thay thế backup database.
2. Giữ các chỉnh sửa riêng: Singbox proxy-only và certificate regression đã nằm trong code CTV; chỉ sao chép thêm `public/ipv4.mobileconfig` nếu cần. Không chép nguyên file Singbox cũ đè lên file mới.
3. Cấu hình domain test khác domain chính, running directory `/public`, SSL/Nginx rewrite, quyền ghi storage/bootstrap/cache và open_basedir. Giới hạn truy cập staging vì bản sao có dữ liệu người dùng.
4. Tạo `.env` riêng, giữ APP_KEY; DB chỉ trỏ staging. Redis nên dùng instance riêng; nếu dùng chung máy chủ, chọn database chưa dùng và prefix riêng cho Redis/cache/Horizon. Không chỉ đổi prefix Horizon trong khi queue vẫn nối database Redis chính. Không xóa cache/queue trên Redis chính.
5. Sao chép cấu hình ứng dụng/theme vào staging và thay domain test. Tắt Telegram, reCAPTCHA và tích hợp thanh toán thật; vô hiệu phương thức thanh toán trong database staging. Đặt `MAIL_MAILER=array` để không phát thư, kể cả khi panel có SMTP. Queue chỉ nối Redis staging. Chưa chạy worker/cron trước khi kiểm tra cách ly.
6. Xóa các cache file được sao chép từ bản cũ nếu có, rồi kiểm tra cấu hình đang trỏ đúng DB/Redis staging. Không sao chép `bootstrap/cache` của production vào release mới.
7. Với **bản sao đã có bảng nền**, chỉ chạy migration bổ sung, không chạy installer hoặc nhập lại `database/install.sql`/`database/update.sql`, không dùng `migrate:fresh`/`migrate:refresh`:

```bash
cd /www/wwwroot/v2pro-laravel12-check-20261011
/www/server/php/83/bin/php artisan config:clear
/www/server/php/83/bin/php artisan package:discover --ansi
/www/server/php/83/bin/php artisan migrate --pretend
/www/server/php/83/bin/php artisan migrate --force
/www/server/php/83/bin/php artisan migrate:status
/www/server/php/83/bin/php artisan config:cache
/www/server/php/83/bin/php artisan view:cache
```

Chỉ chạy các lệnh này sau khi `.env` và file config đã được kiểm tra, DB/Redis thực sự cách ly. `migrate --pretend` vẫn có thể chạy mã PHP trong migration; đây không phải cơ chế sandbox nên luôn dùng DB staging.

Các migration hiện tại chủ yếu thêm cột/bảng CTV và đổi charset. Laravel tự nâng framework không yêu cầu tạo lại bảng user/order/plan. Cần xác nhận phiên bản MySQL/MariaDB đáp ứng framework và thử ALTER trên bản sao dữ liệu thật; SQLite local không chứng minh các câu SQL MySQL.

## Điều kiện chuyển website chính

- Admin, Staff và User đăng nhập/đăng xuất ổn định; Dashboard/Horizon không trả 403 cho Admin hợp lệ, Staff không vào API Admin/Horizon.
- Kiểm tra gói chính, đơn hàng, coupon/gift, ticket ở phạm vi test phù hợp; thanh toán và email chỉ dùng sandbox/người nhận test được cho phép.
- CTV: hai tài khoản độc lập; hạn mức/chặn tạo đồng thời; chuyển khách; cấp/thu hồi gói; appName/emoji và lịch sử thao tác.
- Subscription/link/QR, reset link, certificate/pin/TLS và ứng dụng đồng bộ; so sánh output với production cũ bằng node/khách test.
- Chạy Horizon với đúng PHP CLI và user trên Redis staging; kiểm tra các queue `order_handle`, `traffic_fetch`, `stat`, `send_email`, `send_email_mass`, `send_telegram`. Không replay queue production lên staging. Scheduler/cron chỉ của staging và không gửi tích hợp thật.
- Không có exception bất thường trong log database/PHP-FPM và failed jobs; theo dõi trong một chu kỳ vận hành phù hợp trước khi quyết định cắt chuyển.

Khi cắt chuyển: dừng nhận ghi mới, dừng cron/worker cũ, chốt backup DB/Redis/code/env, cài release production từ đúng lock với `--no-dev`, kiểm tra môi trường, migrate, cache config/view, đổi document root, nạp lại PHP-FPM/OPcache và khởi động lại worker/cron theo đúng release. Không cho worker Laravel cũ và mới cùng tiêu thụ queue khi đang chuyển phiên bản. Giữ thư mục/code/vendor cũ nguyên vẹn.

Rollback phải có quy trình riêng cho schema/dữ liệu và queue: nếu release mới đã ghi dữ liệu, việc khôi phục dump cũ sẽ mất các thay đổi sau backup; không tự động restore hoặc `migrate:rollback` trên production. Ưu tiên kiểm chứng code cũ đọc được schema bổ sung ở staging và thử thao tác đổi document root trước khi cắt chuyển.

## Nguồn tham khảo

- [Laravel 9 upgrade: Symfony Mailer, Flysystem](https://laravel.com/framework/docs/9.x/upgrade)
- [Laravel 10 upgrade: Monolog 3](https://laravel.com/framework/docs/10.x/upgrade)
- [Laravel 11 upgrade: ứng dụng có cấu trúc cũ](https://laravel.com/framework/docs/11.x/upgrade)
- [Laravel 12 upgrade](https://laravel.com/framework/docs/12.x/upgrade)
- [Laravel 12 deployment](https://laravel.com/framework/docs/12.x/deployment)
- [Composer: install từ lock](https://getcomposer.org/doc/01-basic-usage.md#installing-from-composer-lock)
