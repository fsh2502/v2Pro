#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -d .git ]]; then
    echo "Please deploy using a Git checkout."
    exit 1
fi
for tool in git php; do
    command -v "$tool" >/dev/null || { echo "Missing required tool: $tool"; exit 1; }
done

# Preserve local work. Release dependencies must be resolved and tested beforehand.
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Local changes exist. Save them in a reviewed release before updating."
    exit 1
fi
if [[ ! -f composer.lock ]]; then
    echo "Missing composer.lock. Generate, audit and commit a tested lock file before deployment."
    exit 1
fi
if command -v composer >/dev/null; then
    composer_cmd=(composer)
elif [[ -f composer.phar ]]; then
    composer_cmd=(php composer.phar)
else
    echo "Install Composer before running this script."
    exit 1
fi

branch="$(git symbolic-ref --quiet --short HEAD)" || { echo "Detached HEAD; choose a release branch first."; exit 1; }
git pull --ff-only origin "$branch"
[[ -f composer.lock ]] || { echo "The fetched release has no composer.lock."; exit 1; }
"${composer_cmd[@]}" validate --no-check-publish
"${composer_cmd[@]}" install --no-dev --prefer-dist --optimize-autoloader --no-interaction
"${composer_cmd[@]}" check-platform-reqs --no-dev
"${composer_cmd[@]}" audit --no-dev

php artisan v2board:update
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan view:cache
php artisan horizon:terminate

# Adapterman is optional and must already be part of the tested release dependency set.
if [[ -f workerman.webman.php.pid ]]; then
    php -c cli-php.ini webman.php stop
    echo "Webman stopped. Restart it with your process manager."
fi
if [[ -f /etc/init.d/bt ]]; then
    chown -R www -- "$PWD"
fi
echo "Update completed. Verify the web app, scheduler and queue workers."
