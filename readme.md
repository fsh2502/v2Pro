# v2Pro Pro

Bản phát hành của v2Pro dùng Laravel 12, PHP 8.3 và Redis/Horizon, gồm panel Admin, quản lý CTV và giao diện khách hàng iOS Glass. Nhánh phát hành: **`Pro`**. Giữ chức năng gói chính, đơn hàng, thanh toán, node, ticket, mã giảm giá, thẻ quà tặng và các định dạng đăng ký hiện có.

## Chức năng chính

- **Admin:** quản lý người dùng, CTV, hạn mức khách hàng, danh mục gói CTV riêng và quyền dùng từng gói, lịch sử thao tác, máy chủ, thống kê và cấu hình.
- **CTV:** tạo khách trong hạn mức, chỉ quản lý khách đủ điều kiện thuộc mình; thay gói được Admin cấp; appName riêng khi đồng bộ; lịch sử thao tác. Khách có mã nhận diện gắn với CTV.
- **Khách hàng:** iOS Glass sáng/tối, thông tin gói/lưu lượng/hết hạn, đơn hàng, hỗ trợ, tài khoản, QR và đồng bộ ứng dụng theo thiết bị; đổi mật khẩu và đặt lại URL đồng bộ.
- **Vận hành:** database upgrade chạy lại được, dependency được cố định bằng lock, tác vụ nền qua Horizon và lịch chạy mỗi phút.

## Yêu cầu

| Thành phần | Yêu cầu |
| --- | --- |
| Máy chủ | Linux, Nginx + PHP-FPM; hướng dẫn bên dưới dùng aaPanel |
| PHP | 8.3.30 trở lên; CLI và PHP-FPM dùng cùng phiên bản/extension |
| PHP extension | PDO MySQL, Redis (phpredis), curl, mbstring, fileinfo, openssl, sodium; Horizon CLI cần pcntl/posix |
| Database | MySQL/MariaDB; nên dùng phiên bản còn được nhà cung cấp hỗ trợ. Database MySQL 5.7 cũ cần kiểm tra trên bản sao trước |
| Cache/queue | Redis; mỗi website có prefix riêng, staging cách ly dữ liệu |
| Cài dependency | Composer 2, cài từ `composer.lock` |
| Web | HTTPS, document root tại `public/` |

Tài nguyên iOS Glass đã build trong repo; VPS **không cần Node.js** để phục vụ theme. Node chỉ dành cho người phát triển muốn build lại.

## Tải mã nguồn

```bash
git clone --branch Pro --single-branch https://github.com/fsh2502/v2Pro.git /www/wwwroot/v2pro-pro
cd /www/wwwroot/v2pro-pro
```

Hoặc tải [ZIP nhánh Pro](https://github.com/fsh2502/v2Pro/archive/refs/heads/Pro.zip), giải nén vào thư mục website. ZIP GitHub loại các file chỉ dùng phát triển theo `.gitattributes`. Vendor không nằm trong repo/ZIP: vẫn phải cài Composer.

## Cài mới trên aaPanel

1. Tạo website, SSL và **database trống riêng**, dùng tài khoản database của site thay vì tài khoản root MySQL. Chọn PHP 8.3, running directory `public/`, Laravel rewrite. Kiểm tra open_basedir cho phép PHP đọc thư mục ứng dụng.
2. Trong `.env.example`, đặt `APP_URL` là domain HTTPS thật; chọn Redis database/prefix phù hợp. Không tạo `.env` trước khi chạy installer. Mail mặc định `array` để chưa phát thư; bước cấu hình SMTP bên dưới là bắt buộc nếu cần gửi email.
3. Có Composer 2 trong PATH hoặc đặt `COMPOSER_PATH` tới file Composer của bạn, chạy:

```bash
cd /www/wwwroot/v2pro-pro
PHP_BIN=/www/server/php/83/bin/php COMPOSER_PATH=/duong-dan/composer.phar bash init.sh
```

Thay `/duong-dan/composer.phar` bằng đường dẫn thực; bỏ `COMPOSER_PATH` nếu dùng Composer trong PATH với đúng PHP. Installer hỏi thông tin database, ẩn mật khẩu khi nhập, tạo khóa mới **chỉ cho cài mới**, rồi in tài khoản và đường dẫn Admin. Lưu riêng các thông tin này. Installer từ chối database đã có bảng; không xóa `.env` để ép chạy lại trên database đang sử dụng.

4. Thiết lập quyền (ví dụ PHP-FPM aaPanel chạy user `www`):

```bash
cd /www/wwwroot/v2pro-pro
chown -R www:www storage bootstrap/cache config
find storage bootstrap/cache config -type d -exec chmod 750 {} +
find storage bootstrap/cache config -type f -exec chmod 640 {} +
chown root:www .env
chmod 640 .env
```

Mã nguồn/vendor/tài nguyên public cần đọc được bởi PHP-FPM/Nginx. Không cấp `777` hoặc chuyển toàn bộ source thành thư mục web có thể ghi. Nếu script được chạy với umask hạn chế, đặt quyền đọc phù hợp cho các file đã tạo; thư mục release phải cho user web đi qua.

5. Cấu hình Horizon và cron như bên dưới. Mở Admin bằng đường dẫn installer cung cấp, đổi mật khẩu và hoàn tất cấu hình domain, thương hiệu, gói, máy chủ và thanh toán.

## Nâng cấp từ v2Pro cũ, giữ database

**Không chạy installer, không nhập database test đè database thật, không sao chép vendor/composer.lock cũ, không chạy `key:generate`, `migrate:fresh` hoặc `migrate:refresh`.**

1. Sao lưu database, source, `.env`, `config/v2board.php`, `config/theme`, storage và các tài nguyên public tùy chỉnh. Thử khôi phục bản sao vào database staging riêng. Dừng các tích hợp gửi thư/Telegram/thanh toán thật trên staging.
2. Tải nhánh Pro vào **thư mục release mới**. Giữ `.env`, APP_KEY và cấu hình từ website cũ; sao chép file cá nhân cần dùng. Không chép `bootstrap/cache` hoặc compiled views từ bản cũ. Cài vendor từ lock mới.
3. Tại release mới, cài dependency và kiểm tra đúng database/cấu trúc thiếu (thay đường dẫn Composer bằng đường dẫn thực):

```bash
/www/server/php/83/bin/php /duong-dan/composer.phar --no-plugins --no-interaction validate --strict --no-check-publish
/www/server/php/83/bin/php /duong-dan/composer.phar --no-plugins --no-interaction audit --locked --no-dev
/www/server/php/83/bin/php /duong-dan/composer.phar --no-plugins --no-interaction install --no-dev --prefer-dist --optimize-autoloader --no-scripts
/www/server/php/83/bin/php /duong-dan/composer.phar --no-plugins --no-interaction check-platform-reqs --no-dev
/www/server/php/83/bin/php artisan v2board:db-upgrade --check
```

4. Trong cửa sổ bảo trì, dừng website nhận ghi mới, Supervisor/Horizon và cron cũ; chốt backup. Tại release mới chạy:

```bash
PHP_BIN=/www/server/php/83/bin/php COMPOSER_PATH=/duong-dan/composer.phar BACKUP_CONFIRMED=yes bash update.sh
```

Script chỉ chuẩn bị **mã đã tải sẵn**, không tự `git pull` hay `composer update`. Nó cài từ lock, kiểm tra platform/audit, bổ sung cấu trúc database, chạy migration và build cache; khi hoàn tất vẫn giữ chế độ bảo trì. Script không sao lưu thay bạn, không tự đổi cấu hình Nginx/Supervisor/cron và không tự mở website khi lỗi.

Có thể chỉ chuyển cấu trúc database bằng một lệnh, sau khi đã có vendor mới và đúng cấu hình:

```bash
/www/server/php/83/bin/php artisan v2board:db-upgrade --force
```

Lệnh này thêm bảng/cột/index còn thiếu và chạy migration, gồm charset Unicode của CTV; không nhập dữ liệu từ bản test. Giữ khách hàng, mật khẩu và ID hiện có, không tự gán khách cũ cho CTV. DDL MySQL có thể tự commit; khi lỗi, xử lý nguyên nhân rồi chạy lại, không tự động rollback database. [Chi tiết bộ chuyển đổi](docs/database-upgrade-command.md).

5. Chuyển Nginx root, Supervisor directory/command và cron sang **cùng release mới**, reload PHP-FPM/OPcache. Chỉ sau khi xác nhận cấu hình thống nhất, chạy `php artisan up` bằng PHP của site rồi khởi động Horizon/cron. Kiểm tra API, đăng nhập Admin/CTV/khách, gói/đơn hàng, quyền CTV và link đăng ký. Giữ release cũ để quay lại.

Nếu cần rollback, trước hết dừng ghi/worker mới và kiểm tra tính tương thích database. Restore dump cũ sẽ mất dữ liệu phát sinh sau backup; không tự restore hoặc `migrate:rollback` trên production. [Hướng dẫn nâng framework](docs/laravel12-upgrade-2026-10-11.md).

## Horizon và lịch chạy

Dùng mẫu [Supervisor](deploy/supervisor.conf.example), thay đường dẫn release/PHP/user. Chỉ chạy một master Horizon cho site; không để bản cũ và mới cùng tiêu thụ hàng đợi khi chuyển phiên bản.

```ini
[program:v2pro-pro]
directory=/www/wwwroot/v2pro-pro
command=/www/server/php/83/bin/php artisan horizon
user=www
autostart=true
autorestart=true
stopsignal=TERM
stopwaitsecs=3600
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/www/wwwroot/v2pro-pro/storage/logs/horizon.log
```

Thêm lịch cron chạy mỗi phút với user `www`, đúng PHP và release:

```cron
* * * * * cd /www/wwwroot/v2pro-pro && /www/server/php/83/bin/php artisan schedule:run >> /www/wwwroot/v2pro-pro/storage/logs/scheduler.log 2>&1
```

Theo dõi dung lượng và xoay log. Kiểm tra `php artisan horizon:status` và Admin → Trạng thái hệ thống. Không đặt task cron trùng trong aaPanel và crontab.

## Email, giao diện và CTV

- **Email:** đặt `MAIL_MAILER=smtp`, cấu hình SMTP/TLS và địa chỉ gửi trong panel/.env; chạy `config:cache` và khởi động lại Horizon. Gửi thử tới người nhận test trước khi bật gửi hàng loạt. `array` chỉ phục vụ chuẩn bị/staging, không gửi thư thật.
- **Theme:** Admin → Cấu hình giao diện → iOS Glass. Đặt tên website và thương hiệu của bạn; các appName CTV độc lập với tên chung.
- **CTV:** bật vai trò Staff tại Người dùng → Chỉnh sửa. Hạn mức, danh mục gói và phân quyền gói nằm ở **Quản Lý CTV**. CTV dùng `/staff`; gói CTV riêng với gói chính. [Mô hình quyền](docs/staff-ownership.md).
- **Thanh toán/node:** cấu hình cổng của bạn và node được phép, kiểm tra callback/chữ ký, đơn giá nhỏ hoặc sandbox, link/QR/đồng bộ trên ứng dụng thực tế. Không dùng dữ liệu mẫu làm gói bán thật.

## Bảo trì và phát triển

| Lệnh | Công dụng |
| --- | --- |
| `v2board:db-upgrade --check` | Đọc cấu trúc thiếu, không sửa database |
| `v2board:db-upgrade --force` | Bổ sung cấu trúc và chạy migration |
| `v2board:update --check/--force` | Alias tương thích của bộ chuyển đổi |
| `migrate:status` | Xem migration |
| `horizon:status` | Kiểm tra Horizon |
| `config:cache`, `view:cache` | Build cache cấu hình/giao diện |
| `horizon:terminate` | Để process manager khởi động lại worker khi cập nhật cấu hình |

Thêm `php artisan` trước tên lệnh. Chỉ dùng các lệnh reset/xóa dữ liệu khi hiểu tác động và đã sao lưu. Không chạy Composer update trực tiếp trên website chính.

Kiểm thử và build theme trong checkout phát triển riêng:

```bash
composer install --no-interaction --no-scripts
php vendor/bin/phpunit
php tests/deployment-boot-smoke.php
cd frontend/ios-glass
npm ci
npm test
npm run build
```

Workflow `Pro checks` chạy hồi quy PHP, MySQL cô lập, frontend và audit dependency khi nhánh thay đổi; không triển khai website. Chỉ test cô lập được chọn trong `phpunit.xml`; các test mẫu cũ vẫn được giữ nhưng không tham gia suite này. Test local và CI không thay thế kiểm thử SMTP/thanh toán/node với cấu hình của khách hàng. [Danh sách trước phát hành](docs/pro-release.md).

## Giấy phép và thương mại

Giữ nguyên [LICENSE](LICENSE) và thông báo bản quyền upstream khi phân phối. Thư viện/font đi kèm có giấy phép riêng trong `public/theme/ios-glass/`; nguồn artwork/icon nằm ở [SOURCES](frontend/ios-glass/src/assets/clients/SOURCES.md) trong checkout phát triển và [ghi chú thành phần](THIRD-PARTY-NOTICES.md). Giấy phép phần mềm không tự cấp quyền với nhãn hiệu/artwork của ứng dụng hoặc Apple; kiểm tra quyền sử dụng các tài sản đó trước khi phân phối thương mại.

Pro là nhánh chuẩn hóa phát hành, không phải cơ chế cấp phép trả phí, chống sao chép hay cam kết mọi tích hợp của mọi khách hàng đã được kiểm thử. Hỗ trợ/vận hành, chính sách dữ liệu, bản sao lưu và phạm vi dịch vụ cần được xác định khi bán sản phẩm.
