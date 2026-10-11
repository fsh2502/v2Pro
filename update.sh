#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Prepare an already-downloaded release. Never pull or resolve new dependencies here.
php_bin="${PHP_BIN:-php}"
command -v "$php_bin" >/dev/null || { echo "Không tìm thấy PHP CLI."; exit 1; }
[[ -f .env && -f composer.lock ]] || { echo "Thiếu .env hoặc composer.lock. Đọc readme.md."; exit 1; }
[[ "${BACKUP_CONFIRMED:-}" == yes ]] || { echo "Sao lưu database/mã nguồn rồi đặt BACKUP_CONFIRMED=yes."; exit 1; }
"$php_bin" -r 'exit(version_compare(PHP_VERSION, "8.3.30", ">=") ? 0 : 1);' || { echo "Cần PHP 8.3.30 trở lên."; exit 1; }

if [[ -n "${COMPOSER_PATH:-}" && -f "$COMPOSER_PATH" ]]; then
    composer_cmd=("$php_bin" "$COMPOSER_PATH")
elif command -v composer >/dev/null; then
    composer_cmd=("$php_bin" "$(command -v composer)")
elif [[ -f composer.phar ]]; then
    composer_cmd=("$php_bin" composer.phar)
else
    echo "Cài Composer 2 hoặc đặt COMPOSER_PATH tới composer.phar."
    exit 1
fi

"${composer_cmd[@]}" --no-plugins --no-interaction validate --strict --no-check-publish
"${composer_cmd[@]}" --no-plugins --no-interaction audit --locked --no-dev
if [[ -f vendor/autoload.php ]]; then
    "$php_bin" -r 'require "vendor/autoload.php"; $v = Composer\InstalledVersions::getVersion("laravel/framework"); exit((int) $v === 12 ? 0 : 1);' || {
        echo "Vendor framework cũ: dùng thư mục release mới, không cập nhật tại chỗ."
        exit 1
    }
    if "$php_bin" artisan horizon:status >/dev/null 2>&1; then
        echo "Horizon còn chạy. Dừng Supervisor/Horizon và cron của site trước khi cập nhật."
        exit 1
    fi
fi

"${composer_cmd[@]}" --no-plugins --no-interaction install --no-dev --prefer-dist --optimize-autoloader --no-scripts
"${composer_cmd[@]}" --no-plugins --no-interaction check-platform-reqs --no-dev
"$php_bin" artisan down --retry=60
trap 'echo "Cập nhật chưa hoàn tất. Giữ bảo trì, xử lý lỗi trước khi mở website." >&2' ERR
"$php_bin" artisan v2board:db-upgrade --force
"$php_bin" artisan package:discover --ansi
"$php_bin" artisan config:cache
"$php_bin" artisan view:cache
trap - ERR

# Keep maintenance until PHP-FPM, document root, worker and cron point to this release.
echo "Release đã chuẩn bị xong, vẫn ở chế độ bảo trì. Chuyển PHP-FPM/Horizon/cron rồi chạy php artisan up theo readme.md."
