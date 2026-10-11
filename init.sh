#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

command -v php >/dev/null || { echo "Missing PHP CLI."; exit 1; }
php -r 'exit(version_compare(PHP_VERSION, "8.3.30", ">=") ? 0 : 1);' || {
    echo "Use PHP 8.3.30 or newer with this release."
    exit 1
}
[[ -f composer.lock ]] || { echo "Missing the tested composer.lock."; exit 1; }
[[ ! -f .env ]] || { echo "Existing installation detected. Follow docs/laravel12-upgrade-2026-10-11.md instead."; exit 1; }

if command -v composer >/dev/null; then
    composer_cmd=(composer)
elif [[ -f composer.phar ]]; then
    composer_cmd=(php composer.phar)
else
    echo "Install Composer 2 before running this script."
    exit 1
fi

"${composer_cmd[@]}" validate --no-check-publish
"${composer_cmd[@]}" audit --locked --no-dev
"${composer_cmd[@]}" install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-scripts
"${composer_cmd[@]}" check-platform-reqs --no-dev
php artisan v2board:install
php artisan migrate --force
php artisan package:discover --ansi
php artisan config:cache
php artisan view:cache

echo "Installation completed. Configure permissions, isolated services and process management before enabling the website."
