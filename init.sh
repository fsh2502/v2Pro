#!/usr/bin/env bash
set -euo pipefail
umask 022
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

php_bin="${PHP_BIN:-php}"
command -v "$php_bin" >/dev/null || { echo "Không tìm thấy PHP CLI."; exit 1; }
"$php_bin" -r 'exit(version_compare(PHP_VERSION, "8.3.30", ">=") ? 0 : 1);' || {
    echo "Bản Pro cần PHP 8.3.30 trở lên."
    exit 1
}
[[ -f composer.lock ]] || { echo "Thiếu composer.lock đã kiểm thử."; exit 1; }
[[ ! -f .env ]] || { echo "Đã có .env. Đọc readme.md để nâng cấp website hiện có."; exit 1; }

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
"${composer_cmd[@]}" --no-plugins --no-interaction install --no-dev --prefer-dist --optimize-autoloader --no-scripts
"${composer_cmd[@]}" --no-plugins --no-interaction check-platform-reqs --no-dev
"$php_bin" artisan v2board:install
"$php_bin" artisan migrate --force
"$php_bin" artisan package:discover --ansi
"$php_bin" artisan config:cache
"$php_bin" artisan view:cache

echo "Cài mới hoàn tất. Thiết lập HTTPS, quyền file, SMTP, Horizon và cron theo readme.md trước khi sử dụng."
