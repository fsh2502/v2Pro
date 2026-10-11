# v2Pro — nhánh Max

Max dùng Laravel 12, PHP 8.3 và Redis/Horizon, gồm panel Admin, quản lý CTV và giao diện khách hàng iOS Glass. Hướng dẫn này tổng hợp quy trình cài mới và nâng cấp trên **aaPanel/BaoTa + Nginx + PHP-FPM**.

Các khối Bash chạy trong terminal VPS bằng root. Ví dụ dùng thư mục mới **/www/wwwroot/v2pro-max**, source cũ **/www/wwwroot/v2Pro**, PHP **/www/server/php/83/bin/php** và Composer **/root/composer.phar**. Nếu môi trường khác, đổi các đường dẫn trước khi chạy.

| Tình trạng | Quy trình |
| --- | --- |
| Database trống, chưa có website | Cài mới ở phần 2 |
| Đang dùng v2Pro cũ, cần giữ khách hàng | Nâng cấp ở phần 3 |
| Max đã chạy và API đạt HTTP 200 | Không cài lại; dùng phần vận hành |

## 1. Chuẩn bị chung

### 1.1. Yêu cầu

| Thành phần | Yêu cầu |
| --- | --- |
| PHP | 8.3.30 trở lên; CLI và PHP-FPM cùng phiên bản |
| Extension | PDO MySQL, phpredis, curl, mbstring có mbregex/mb_split, fileinfo, openssl, sodium; Horizon CLI cần pcntl/posix |
| Database | MySQL/MariaDB; database cũ cần thử trên bản sao trước |
| Redis | Hoạt động; staging dùng database/prefix tách biệt với website chính |
| Composer | Composer 2; cài đúng composer.lock của Max |
| Website | Running directory public/, Laravel rewrite, HTTPS cho người dùng |

Theme iOS Glass đã build trong repo; VPS không cần Node.js để phục vụ theme.

Trong aaPanel → App Store → PHP 8.3 → Settings → Install extensions, cài extension còn thiếu và Reload PHP 8.3. PHP từ gói hệ điều hành có thể là interpreter khác với PHP của aaPanel.

Kiểm tra native mbstring trước khi dùng Artisan:

~~~bash
(
set -eu
deploy_php=/www/server/php/83/bin/php
"$deploy_php" -v
"$deploy_php" --ini
check_mbstring='
echo "INI: ", php_ini_loaded_file(), PHP_EOL;
echo "mbstring: ", extension_loaded("mbstring") ? "PASS" : "THIEU", PHP_EOL;
echo "mb_split: ", function_exists("mb_split") ? "PASS" : "THIEU", PHP_EOL;
exit(extension_loaded("mbstring") && function_exists("mb_split") ? 0 : 1);
'
"$deploy_php" -r "$check_mbstring"
"$deploy_php" -c /www/server/php/83/etc/php.ini -r "$check_mbstring"
)
~~~

Cả hai phải đạt PASS. Phép thử thứ hai kiểm tra CLI đọc php.ini; PHP-FPM vẫn cần reload để nhận cấu hình mới. Composer có thể báo ext-mbstring đạt nhờ polyfill dù mb_split() còn thiếu. Không tiếp tục migration khi thiếu hàm này.

### 1.2. Chuẩn bị Composer tại đường dẫn thực

Các lệnh dưới đây dùng /root/composer.phar. Nếu chưa có file này, khối sau tải installer và kiểm tra SHA-384 theo [hướng dẫn chính thức của Composer](https://getcomposer.org/doc/faqs/how-to-install-composer-programmatically.md):

~~~bash
(
set -eu
deploy_php=/www/server/php/83/bin/php
if [ ! -f /root/composer.phar ]; then
    composer_tmp=$(mktemp -d)
    expected=$(curl -fsSL https://composer.github.io/installer.sig)
    curl -fsSL https://getcomposer.org/installer -o "$composer_tmp/installer.php"
    actual=$("$deploy_php" -r 'echo hash_file("sha384", $argv[1]);' "$composer_tmp/installer.php")
    if [ "$expected" != "$actual" ]; then
        echo "DỪNG: checksum installer Composer không khớp."
        exit 1
    fi
    "$deploy_php" "$composer_tmp/installer.php" --2 --install-dir=/root --filename=composer.phar
fi
"$deploy_php" /root/composer.phar --version
)
~~~

Nếu dùng Composer 2 đã có trong website cũ, thay /root/composer.phar bằng đường dẫn file thực. Không gõ đường dẫn minh họa /duong-dan/composer.phar.

### 1.3. Tải mã nguồn

~~~bash
(
set -eu
release_dir=/www/wwwroot/v2pro-max
if [ -e "$release_dir" ]; then
    echo "DỪNG: thư mục đã tồn tại. Kiểm tra nội dung hoặc chọn release mới."
    exit 1
fi
git clone --branch Max --single-branch https://github.com/fsh2502/v2Pro.git "$release_dir"
cd "$release_dir"
git rev-parse HEAD
/www/server/php/83/bin/php scripts/check-php-runtime.php
)
~~~

Hoặc tải [ZIP nhánh Max](https://github.com/fsh2502/v2Pro/archive/refs/heads/Max.zip). Giải nén sao cho artisan, composer.json và composer.lock nằm trực tiếp trong thư mục release. ZIP không chứa vendor; vẫn phải cài dependency. Ghi lại commit triển khai, không đổi commit giữa quá trình chuyển đổi.

## 2. Cài mới

### 2.1. Tạo website và database

Trong aaPanel:

1. Tạo website với tên miền thực, chọn PHP 8.3 và **database trống riêng**, tài khoản database riêng.
2. Chọn site directory /www/wwwroot/v2pro-max, running directory public/ và Laravel rewrite.
3. Kiểm tra open_basedir cho phép PHP đọc thư mục ứng dụng.
4. Thiết lập HTTPS cho người dùng; nếu dùng CDN/reverse proxy, xác định riêng cổng Nginx origin.

Trong .env.example, đặt APP_URL theo URL thật và chọn Redis database/prefix riêng. Giữ APP_ENV=production và APP_DEBUG=false. SMTP mặc định array, chưa gửi email thật.

**Không tạo .env trước installer.** Installer tự tạo .env, APP_KEY và tài khoản Admin, chỉ dùng trên database trống.

### 2.2. Chạy installer

~~~bash
(
set -eu
cd /www/wwwroot/v2pro-max
PHP_BIN=/www/server/php/83/bin/php COMPOSER_PATH=/root/composer.phar bash init.sh
)
~~~

Dùng **bash init.sh**, không dùng sh init.sh. Nhập thông tin database và email Admin khi được hỏi. Lưu mật khẩu và đường dẫn Admin được in ra, đổi mật khẩu sau lần đăng nhập đầu.

Nếu báo đã có .env hoặc database có bảng, dừng để kiểm tra. Không xóa .env hay dữ liệu để ép cài mới trên website đang sử dụng.

### 2.3. Quyền file

Áp dụng sau installer, rồi đi tiếp phần 4:

~~~bash
(
set -eu
cd /www/wwwroot/v2pro-max
mkdir -p storage/app storage/framework/cache/data \
    storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www:www storage bootstrap/cache config
find storage bootstrap/cache config -type d -exec chmod 750 {} +
find storage bootstrap/cache config -type f -exec chmod 640 {} +
chown root:www .env
chmod 640 .env
)
~~~

Source, vendor và public cần đọc được bởi PHP-FPM/Nginx. Không cấp 777 cho toàn bộ website. Nếu user PHP-FPM khác www, thay user/group cho phù hợp.

## 3. Nâng cấp từ v2Pro cũ, giữ dữ liệu

### 3.1. Backup và sao chép cấu hình

Sao lưu bằng aaPanel cả database và source/cấu hình. Giữ .env, config/v2board.php, config/theme, storage/app và tài nguyên public tùy chỉnh. Thử khôi phục vào staging riêng; staging không dùng chung Redis và không gửi thư/Telegram/thanh toán thật.

Tải release mới theo phần 1.3. Đối chiếu git diff của source cũ và tích hợp các chỉnh sửa riêng vào release mới trước khi chuyển.

~~~bash
(
set -eu
old=/www/wwwroot/v2Pro
new=/www/wwwroot/v2pro-max
test -f "$old/.env"
test -f "$old/config/v2board.php"
if [ -e "$new/.env" ]; then
    echo "DỪNG: release mới đã có .env; kiểm tra trước khi sao chép."
    exit 1
fi
cp -a "$old/.env" "$new/.env"
cp -a "$old/config/v2board.php" "$new/config/v2board.php"
if [ -d "$old/config/theme" ]; then
    cp -a "$old/config/theme" "$new/config/"
fi
if [ -d "$old/storage/app" ]; then
    mkdir -p "$new/storage/app"
    cp -a "$old/storage/app/." "$new/storage/app/"
fi
if [ -f "$old/public/ipv4.mobileconfig" ]; then
    cp -a "$old/public/ipv4.mobileconfig" "$new/public/ipv4.mobileconfig"
fi
)
~~~

Giữ nguyên APP_KEY, database, Redis và các prefix của website cũ. Nếu dùng session lưu file, giữ dữ liệu phiên phù hợp từ storage/framework/sessions. Rà soát các tài nguyên public riêng khác trước khi chuyển.

**Không chép vendor, composer.lock, bootstrap/cache hoặc compiled views cũ vào Max. Không chạy installer, key:generate, migrate:fresh, migrate:refresh hoặc nhập database test đè database thật.**

### 3.2. Cài vendor và kiểm tra chỉ đọc

~~~bash
(
set -eu
cd /www/wwwroot/v2pro-max
deploy_php=/www/server/php/83/bin/php
"$deploy_php" scripts/check-php-runtime.php
"$deploy_php" /root/composer.phar --no-plugins --no-interaction validate --strict --no-check-publish
"$deploy_php" /root/composer.phar --no-plugins --no-interaction audit --locked --no-dev
"$deploy_php" /root/composer.phar --no-plugins --no-interaction install --no-dev --prefer-dist --optimize-autoloader --no-scripts
"$deploy_php" /root/composer.phar --no-plugins --no-interaction check-platform-reqs --no-dev
"$deploy_php" <<'PHP'
<?php
require 'vendor/autoload.php';
(new App\Services\EnvironmentFileService)->update(
    getcwd() . '/.env',
    ['APP_ENV' => 'production', 'APP_DEBUG' => 'false']
);
PHP
"$deploy_php" artisan config:clear
"$deploy_php" artisan v2board:db-upgrade --check
"$deploy_php" artisan migrate:status
)
~~~

Xác nhận tên database in ra đúng database cần nâng cấp. --check chỉ đọc, chưa chạy migration. **0 thay đổi cấu trúc không có nghĩa migration hoàn tất**; xem thêm trạng thái Ran/Pending.

### 3.3. Bảo trì, dừng worker và cron cũ

Chốt backup, đặt cả hai release vào bảo trì:

~~~bash
(
set -eu
cd /www/wwwroot/v2Pro
runuser -u www -- /www/server/php/83/bin/php artisan down --retry=60
cd /www/wwwroot/v2pro-max
runuser -u www -- /www/server/php/83/bin/php artisan down --retry=60
)
~~~

Trong aaPanel, tạm dừng cron và dừng chương trình Supervisor/Horizon cũ. Đợi job đang chạy kết thúc. Kiểm tra không còn master, supervisor, queue worker hoặc scheduler của release cũ; kiểm tra PID và thư mục làm việc khi cần.

Nếu Supervisor báo not running, kiểm tra tiến trình con thay vì coi đó là lỗi migration. **503 trong giai đoạn này là trạng thái bảo trì dự kiến.** Chưa chuyển Nginx hay mở website trước khi migration hoàn tất.

### 3.4. Hoàn tất database và cache

Áp dụng quyền file ở phần 2.3. Sau khi đã backup và dừng worker/cron cũ:

~~~bash
(
set -eu
cd /www/wwwroot/v2pro-max
PHP_BIN=/www/server/php/83/bin/php COMPOSER_PATH=/root/composer.phar BACKUP_CONFIRMED=yes bash update.sh
runuser -u www -- /www/server/php/83/bin/php artisan migrate:status
runuser -u www -- /www/server/php/83/bin/php artisan v2board:db-upgrade --check
)
~~~

update.sh chuẩn bị source đã tải sẵn, cài từ lock, chạy bộ chuyển đổi và build cache; không tự tải commit khác hay mở website. Áp dụng lại quyền file ở phần 2.3 sau khi script tạo cache.

Bộ chuyển đổi thêm bảng/cột/index thiếu và chạy migration, gồm hỗ trợ Unicode cho CTV. Khách hàng, mật khẩu và ID cũ được giữ; khách cũ không tự gán cho CTV. MySQL DDL có thể tự commit: nếu bị gián đoạn, xử lý nguyên nhân rồi chạy lại; không tự nhập lại database. [Chi tiết bộ chuyển đổi](docs/database-upgrade-command.md).

Đi tiếp khi lệnh báo hoàn tất, tất cả migration Ran và không còn cấu trúc thiếu. Website vẫn giữ bảo trì.

## 4. Chuyển cấu hình runtime

Trong aaPanel → Website, chọn đúng website và đặt:

- Site directory: /www/wwwroot/v2pro-max.
- Running directory: public/.
- PHP 8.3, Laravel rewrite.
- Domain binding: tên miền người dùng thực sự truy cập.

Kiểm tra và reload:

~~~bash
(
set -eu
/www/server/nginx/sbin/nginx -t
/etc/init.d/nginx reload
/etc/init.d/php-fpm-83 reload
echo "=== Các cổng Nginx ==="
ss -ltnp | awk 'NR == 1 || /nginx/'
echo "=== Root và tên miền vhost ==="
grep -nE '^[[:space:]]*(listen|server_name|root)[[:space:]]' \
    /www/server/panel/vhost/nginx/*.conf
)
~~~

Tên file vhost không quyết định tên miền. Ví dụ file example.com.conf có thể chỉ bind panel.example.com và vpn.example.com. Phép thử phải dùng tên trong **server_name**.

HTTPS ở CDN/reverse proxy không đồng nghĩa Nginx origin nghe cổng 443. Nếu Nginx chỉ listen 80, dùng HTTP nội bộ với Host đúng; không giả định 127.0.0.1:443 có dịch vụ.

## 5. Mở website và kiểm tra API

Ví dụ sau dùng origin HTTP **127.0.0.1:80**, chỉ chạy sau khi phần 4 xác nhận địa chỉ/cổng đó nhận kết nối. Nhập tên miền trong server_name khi được hỏi. Nếu origin chỉ nghe HTTPS hoặc IP khác, dùng địa chỉ phù hợp cấu hình thực tế; HTTPS cần hostname/SNI và chứng chỉ hợp lệ.

~~~bash
(
set -eu
cd /www/wwwroot/v2pro-max
deploy_php=/www/server/php/83/bin/php
read -r -p 'Tên miền trong server_name: ' domain
case "$domain" in
    ''|*[!a-zA-Z0-9.-]*) echo "DỪNG: tên miền không hợp lệ."; exit 1 ;;
esac
"$deploy_php" <<'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (config('app.env') !== 'production' || config('app.debug')) {
    fwrite(STDERR, "DỪNG: cần APP_ENV=production và APP_DEBUG=false.\n");
    exit(1);
}
PHP
probe_file=$(mktemp)
runuser -u www -- "$deploy_php" artisan up
if ! http_code=$(curl -sS --connect-timeout 5 --max-time 20 \
    -H "Host: $domain" -H 'Accept: application/json' \
    -o "$probe_file" -w '%{http_code}' \
    http://127.0.0.1/api/v1/guest/comm/config); then
    runuser -u www -- "$deploy_php" artisan down --retry=60
    echo "DỪNG: không kiểm tra được API; đã bật lại bảo trì."
    exit 1
fi
echo "Guest API HTTP: $http_code"
if [ "$http_code" != 200 ] ||
   ! "$deploy_php" -n -r '
       $data = json_decode(file_get_contents($argv[1]), true);
       exit(is_array($data) && isset($data["data"]) && is_array($data["data"]) ? 0 : 1);
   ' "$probe_file"; then
    runuser -u www -- "$deploy_php" artisan down --retry=60
    echo "DỪNG: API chưa đạt; đã bật lại bảo trì."
    exit 1
fi
echo "PASS: website đã mở, API trả JSON hợp lệ."
)
~~~

HTTP 200 + JSON hợp lệ xác nhận API guest tại origin. Kiểm tra tiếp URL public trong trình duyệt, đăng nhập Admin/khách/CTV, đọc dữ liệu cũ, gói được cấp, lịch sử thao tác và link đồng bộ. Kiểm thử node, callback thanh toán và email với cấu hình thực trước khi xác nhận toàn bộ tích hợp.

## 6. Horizon và scheduler

### 6.1. Horizon

Sau khi API đạt, tạo chương trình Supervisor hoặc sửa chương trình cũ trong aaPanel. Chỉ để một master Horizon cho website, dùng PHP tuyệt đối:

~~~ini
[program:v2pro-max]
process_name=%(program_name)s_%(process_num)02d
directory=/www/wwwroot/v2pro-max
command=/www/server/php/83/bin/php artisan horizon
user=www
numprocs=1
autostart=true
autorestart=true
stopsignal=TERM
stopwaitsecs=3600
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/www/wwwroot/v2pro-max/storage/logs/horizon.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=5
~~~

[Mẫu Supervisor](deploy/supervisor.conf.example). Nếu giữ tên chương trình cũ, giữ section/process name aaPanel đang quản lý, đổi directory/command sang Max. Lưu/reload cấu hình và start bằng aaPanel, kiểm tra RUNNING.

~~~bash
cd /www/wwwroot/v2pro-max
runuser -u www -- /www/server/php/83/bin/php artisan horizon:status
~~~

Lấy PID từ Supervisor rồi kiểm tra /proc/PID/cwd và /proc/PID/exe khi cần xác minh process thực. Chúng phải trỏ tới release mới và PHP 8.3 của aaPanel.

### 6.2. Scheduler: chọn một cách

**Cách A — aaPanel → Cron → Shell Script:** chọn chu kỳ mỗi phút. Nội dung script chỉ gồm:

~~~bash
cd /www/wwwroot/v2pro-max && /www/server/php/83/bin/php artisan schedule:run >> /www/wwwroot/v2pro-max/storage/logs/scheduler.log 2>&1
~~~

**Không thêm `* * * * *` trong nội dung script aaPanel.** Các dấu sao là cú pháp lịch của crontab, không phải lệnh shell. [Mẫu script aaPanel](deploy/aapanel-cron.sh.example).

**Cách B — crontab user www:** mở bằng crontab -u www -e, thêm đầy đủ dòng lịch:

~~~cron
* * * * * cd /www/wwwroot/v2pro-max && /www/server/php/83/bin/php artisan schedule:run >> /www/wwwroot/v2pro-max/storage/logs/scheduler.log 2>&1
~~~

[Mẫu crontab](deploy/crontab.example). Chọn một cách và bỏ lịch cũ để tránh chạy trùng. Nếu aaPanel chạy task dưới root, có thể dùng runuser -u www -- /www/server/php/83/bin/php artisan schedule:run sau lệnh cd; kiểm tra quyền ghi log theo user thực tế. Xác nhận task được gọi mỗi phút qua aaPanel/crontab và log, không chỉ nhìn nội dung script.

## 7. Vận hành và xử lý lỗi

| Hiện tượng | Xử lý |
| --- | --- |
| Thiếu vendor/autoload.php | Cài dependency từ lock Max trước Artisan |
| Không mở được composer.phar | Dùng đường dẫn file thực ở phần 1.2 |
| mb_split() không tồn tại | Cài mbstring native có mbregex cho PHP aaPanel, kiểm tra CLI/FPM rồi reload |
| Pending dù không thiếu cấu trúc | Dừng worker/cron, dùng db-upgrade --force sau backup; xem lại migrate:status |
| Migration lỗi | Giữ bảo trì; dùng v2board:db-upgrade --force --diagnose khi đã đáp ứng điều kiện backup/dừng ghi |
| 503 | Kiểm tra bảo trì và log; chỉ artisan up khi release đã sẵn sàng |
| API nội bộ 404 | Kiểm tra Host/server_name, root public/ và Laravel rewrite |
| Connection refused tại 443 | Kiểm tra IP/cổng Nginx thực bằng ss, chưa thể kết luận lỗi ứng dụng |
| ZIP nạp hai lần | Sao lưu INI, giữ một dòng nạp ZIP trong mỗi cấu hình, reload PHP-FPM |
| Horizon not running | Kiểm tra Supervisor, tiến trình con, directory, PHP, extension và log |

Giữ release cũ và backup sau chuyển đổi. Nếu rollback, dừng ghi/worker mới trước và kiểm tra tương thích schema. Restore dump cũ sẽ mất dữ liệu phát sinh sau backup; không tự migrate:rollback trên production. [Hướng dẫn nâng framework](docs/laravel12-upgrade-2026-10-11.md).

Không composer update hoặc kéo source khác giữa lần triển khai. Dùng release mới và lock đã kiểm thử. Lệnh deployment không tự backup database.

## 8. Email, giao diện và CTV

- **Email:** đặt `MAIL_MAILER=smtp`, cấu hình SMTP/TLS và địa chỉ gửi trong panel/.env; chạy `config:cache` và khởi động lại Horizon. Gửi thử tới người nhận test trước khi bật gửi hàng loạt. `array` chỉ phục vụ chuẩn bị/staging, không gửi thư thật.
- **Theme:** Admin → Cấu hình giao diện → iOS Glass. Đặt tên website và thương hiệu của bạn; các appName CTV độc lập với tên chung.
- **CTV:** bật vai trò Staff tại Người dùng → Chỉnh sửa. Hạn mức, danh mục gói và phân quyền gói nằm ở **Quản Lý CTV**. CTV dùng `/staff`; gói CTV riêng với gói chính. [Mô hình quyền](docs/staff-ownership.md).
- **Thanh toán/node:** cấu hình cổng của bạn và node được phép, kiểm tra callback/chữ ký, đơn giá nhỏ hoặc sandbox, link/QR/đồng bộ trên ứng dụng thực tế. Không dùng dữ liệu mẫu làm gói bán thật.

## 9. Bảo trì và phát triển

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
composer install --no-interaction --no-plugins --no-scripts
php vendor/bin/phpunit
php tests/deployment-boot-smoke.php
cd frontend/ios-glass
npm ci
npm test
npm run build
```

Workflow `Max checks` chạy hồi quy PHP, MySQL cô lập, frontend và audit dependency khi nhánh thay đổi; không triển khai website. Chỉ test cô lập được chọn trong `phpunit.xml`; các test mẫu cũ vẫn được giữ nhưng không tham gia suite này. Test local và CI không thay thế kiểm thử SMTP/thanh toán/node với cấu hình của khách hàng. [Danh sách trước phát hành](docs/pro-release.md).

## 10. Giấy phép và thương mại

Giữ nguyên [LICENSE](LICENSE) và thông báo bản quyền upstream khi phân phối. Thư viện/font đi kèm có giấy phép riêng trong `public/theme/ios-glass/`; nguồn artwork/icon nằm ở [SOURCES](frontend/ios-glass/src/assets/clients/SOURCES.md) trong checkout phát triển và [ghi chú thành phần](THIRD-PARTY-NOTICES.md). Giấy phép phần mềm không tự cấp quyền với nhãn hiệu/artwork của ứng dụng hoặc Apple; kiểm tra quyền sử dụng các tài sản đó trước khi phân phối thương mại.

Max là nhánh chuẩn hóa phát hành, không phải cơ chế cấp phép trả phí, chống sao chép hay cam kết mọi tích hợp của mọi khách hàng đã được kiểm thử. Hỗ trợ/vận hành, chính sách dữ liệu, bản sao lưu và phạm vi dịch vụ cần được xác định khi bán sản phẩm.
