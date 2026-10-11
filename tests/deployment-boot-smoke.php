<?php

// Boot the real providers/routes without loading the site's .env or contacting services.
// V2PRO_TEST_AUTOLOAD may point to a separate dependency installation for local checks.
require __DIR__ . '/staff-bootstrap.php';
$root = dirname(__DIR__);
$scratch = $root . '/artifacts/deployment-review/boot';
if (!is_dir($scratch)) mkdir($scratch, 0777, true);
foreach (['APP_CONFIG_CACHE' => 'config', 'APP_SERVICES_CACHE' => 'services', 'APP_PACKAGES_CACHE' => 'packages',
    'APP_ROUTES_CACHE' => 'routes', 'APP_EVENTS_CACHE' => 'events'] as $key => $name) {
    putenv($key . '=artifacts/deployment-review/boot/' . $name . '.php');
}
foreach (['APP_ENV' => 'testing', 'APP_KEY' => 'base64:' . base64_encode(str_repeat('k', 32)),
    'APP_DEBUG' => 'false', 'CACHE_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync',
    'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:', 'LOG_CHANNEL' => 'errorlog',
    'VIEW_COMPILED_PATH' => $scratch] as $key => $value) putenv($key . '=' . $value);
$app = require $root . '/bootstrap/app.php';
$app->useEnvironmentPath($scratch);
$app->loadEnvironmentFrom('nonexistent-test.env');
$manifest = new \Illuminate\Foundation\PackageManifest(new \Illuminate\Filesystem\Filesystem(), $root, $app->getCachedPackagesPath());
$manifest->vendorPath = dirname($autoload);
$manifest->build();
$app->instance(\Illuminate\Foundation\PackageManifest::class, $manifest);
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
// Production keeps its database logger; this isolated check never uses it.
config(['logging.default' => 'errorlog']);
$errors = [];
$count = 0; $applicationRoutes = 0;
foreach ($app['router']->getRoutes() as $route) {
    $count++;
    if (strpos($route->uri(), 'api/') === 0 || !$route->getAction('controller')) $applicationRoutes++;
    $action = $route->getAction('controller');
    if (!$action) continue;
    [$class, $method] = array_pad(explode('@', $action, 2), 2, '__invoke');
    if (!class_exists($class) || !method_exists($class, $method)) {
        $errors[] = $route->uri() . ': missing ' . $class . '@' . $method;
        continue;
    }
    $reflection = new ReflectionClass($class);
    if (strpos($class, 'App\\') === 0) {
        $expected = $root . '/app/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (str_replace('\\', '/', $reflection->getFileName()) !== str_replace('\\', '/', $expected)) {
            $errors[] = $route->uri() . ': class/file case mismatch ' . $class;
        }
    }
}
foreach (['staff', 'admin'] as $view) {
    $html = $app['view']->make($view, [
        'title' => 'Smoke test', 'theme_sidebar' => 'light', 'theme_header' => 'dark', 'theme_color' => 'default',
        'background_url' => '', 'version' => 'smoke', 'logo' => '', 'secure_path' => 'smoke-admin'
    ])->render();
    preg_match_all('~(?:src|href)="(/assets/[^"?]+)~', $html, $matches);
    foreach ($matches[1] as $asset) {
        if ($asset === '/assets/admin/custom.css') continue; // Optional deployment override.
        if (!is_file($root . '/public' . $asset)) $errors[] = $view . ': missing asset ' . $asset;
    }
}
$schema = $app['db']->connection()->getSchemaBuilder();
$schema->create('v2_user', function ($table) {
    $table->increments('id'); $table->string('email');
    $table->string('password')->nullable(); $table->string('password_algo')->nullable();
    $table->string('password_salt')->nullable(); $table->string('token')->nullable();
    $table->integer('is_admin')->default(0); $table->integer('is_staff')->default(0);
    $table->integer('banned')->default(0);
});
$schema->create('v2_notice', function ($table) { $table->increments('id'); });
$app['db']->table('v2_user')->insert(['id' => 7, 'email' => 'legacy@example.com']);
$migrations = [
    '2026_10_07_000000_add_staff_ownership.php' => 'AddStaffOwnership',
    '2026_10_07_000001_add_staff_customer_creator.php' => 'AddStaffCustomerCreator',
    '2026_10_07_000002_add_staff_app_name.php' => 'AddStaffAppName',
    '2026_10_07_000003_add_staff_plans.php' => 'AddStaffPlans',
    '2026_10_08_000000_add_staff_activity_log.php' => 'AddStaffActivityLog',
    '2026_10_08_000001_allow_staff_unicode_text.php' => 'AllowStaffUnicodeText',
];
foreach ($migrations as $file => $class) {
    require_once $root . '/database/migrations/' . $file;
    (new $class())->up();
    (new $class())->up(); // Replay must preserve existing rows and tables.
}
// Simulate an SQL-installed site with an existing failed_jobs table but no
// migration ledger, then run the complete Artisan migration command twice.
require_once $root . '/database/migrations/2019_08_19_000000_create_failed_jobs_table.php';
(new CreateFailedJobsTable())->up();
$app['db']->table('failed_jobs')->insert([
    'connection' => 'redis', 'queue' => 'test', 'payload' => 'legacy-job',
    'exception' => 'synthetic failure',
]);
for ($attempt = 0; $attempt < 2; $attempt++) {
    if (\Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]) !== 0) {
        $errors[] = 'Full Artisan migration command failed on SQL-installed schema.';
    }
}
if ($app['db']->table('migrations')->count() !== count($migrations) + 1 ||
    $app['db']->table('failed_jobs')->where('payload', 'legacy-job')->count() !== 1) {
    $errors[] = 'Full migration did not record all migrations or preserve legacy failed jobs.';
}
$legacy = $app['db']->table('v2_user')->where('id', 7)->first();
if ($legacy->email !== 'legacy@example.com' || $legacy->staff_creator_id !== null || (int) $legacy->staff_customer_limit !== 0) {
    $errors[] = 'Legacy migration changed existing identity/creator/quota unexpectedly.';
}
$schema->create('v2_knowledge', function ($table) {
    $table->increments('id'); $table->string('category'); $table->string('language'); $table->integer('show');
});
$app['db']->table('v2_knowledge')->insert([
    ['category' => 'Visible', 'language' => 'vi-VN', 'show' => 1],
    ['category' => 'Hidden', 'language' => 'vi-VN', 'show' => 0],
    ['category' => 'Other language', 'language' => 'en-US', 'show' => 1],
]);
$controller = new \App\Http\Controllers\V1\User\KnowledgeController();
$categories = json_decode($controller->getCategory(\Illuminate\Http\Request::create('/', 'GET', ['language' => 'vi-VN']))->getContent(), true);
if ($categories['data'] !== ['Visible']) $errors[] = 'Knowledge categories exposed hidden/wrong-language articles.';
foreach ([$controller, new \App\Http\Controllers\V1\Admin\KnowledgeController()] as $controller) {
    try {
        $controller->fetch(\Illuminate\Http\Request::create('/', 'GET', ['id' => 9999]));
        $errors[] = 'Missing knowledge article did not return 404.';
    } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
        if ($e->getStatusCode() !== 404) $errors[] = 'Missing knowledge article returned wrong status.';
    }
}
if (\App\Services\SubscriptionNameService::forStaff(new \App\Models\User(['id' => 7, 'staff_app_name' => '0'])) !== '0') {
    $errors[] = 'Personal subscription name 0 was replaced by the fallback.';
}
$environments = $app['config']->get('horizon.environments');
if (empty($environments['*']['V2board']['queue']) || $environments['*']['V2board']['maxProcesses'] < 1) {
    $errors[] = 'Horizon has no valid worker configuration for production.';
}

// Execute the actual HTTP kernel (including global middleware and FormRequest validation).
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$adminPath = config('v2board.secure_path', config('v2board.frontend_admin_path', hash('crc32b', config('app.key'))));
$http = function ($path, $method = 'GET', array $data = [], $token = null) use ($kernel) {
    $request = \Illuminate\Http\Request::create('http://localhost' . $path, $method, $data);
    $request->headers->set('Accept', 'application/json');
    if ($token !== null) $request->headers->set('Authorization', $token);
    return $kernel->handle($request);
};
foreach ([
    ['/api/v1/guest/comm/config', 'GET', 200],
    ['/api/v1/passport/auth/login', 'POST', 422],
    ['/api/v1/' . $adminPath . '/config/fetch', 'GET', 403],
    ['/staff', 'GET', 200],
    ['/' . $adminPath, 'GET', 200],
    ['/api/v1/nonexistent-framework-regression', 'GET', 404],
] as [$path, $method, $status]) {
    $response = $http($path, $method);
    if ($response->getStatusCode() !== $status) $errors[] = $path . ': HTTP kernel returned ' . $response->getStatusCode() . ', expected ' . $status;
}
$app['db']->table('v2_user')->where('id', 7)->update([
    'password' => password_hash('isolated-regression-password', PASSWORD_BCRYPT), 'is_admin' => 1,
]);
$response = $http('/api/v1/passport/auth/login', 'POST', ['email' => 'legacy@example.com', 'password' => 'isolated-regression-password']);
$authData = json_decode($response->getContent(), true)['data']['auth_data'] ?? null;
if ($response->getStatusCode() !== 200 || !$authData) {
    $errors[] = 'Login failed through the complete HTTP kernel.';
} else {
    // The Horizon dashboard API must accept both cold and cached JWT sessions.
    for ($attempt = 0; $attempt < 2; $attempt++) {
        // Stats requires Redis, which is intentionally unavailable in this check.
        // Authorize the registered middleware directly instead of invoking that controller.
        $horizonRequest = \Illuminate\Http\Request::create('/horizon/api/stats');
        $horizonRequest->headers->set('Authorization', $authData);
        $horizonMiddleware = new \Laravel\Horizon\Http\Middleware\Authenticate();
        $authorized = $horizonMiddleware->handle($horizonRequest, fn () => true);
        if ($authorized !== true) $errors[] = 'Horizon rejected the valid Admin session.';
    }
    $app['db']->table('v2_user')->where('id', 7)->update(['banned' => 1]);
    if ($http('/api/v1/' . $adminPath . '/config/fetch', 'GET', [], $authData)->getStatusCode() !== 403) {
        $errors[] = 'HTTP middleware retained a banned Admin session.';
    }
}
echo 'Real application boot with package discovery: ' . $count . ' routes (' . $applicationRoutes . ' application routes); Staff/Admin views rendered; ' . count($errors) . " errors\n";
echo "Six migrations replayed on SQLite; legacy identity preserved; knowledge visibility/404 and production worker configuration checked.\n";
echo "Full Artisan migrate replayed twice without an initial ledger; all seven migrations recorded and legacy failed job preserved.\n";
echo "HTTP kernel: guest configuration, validation, denied Admin, panels, missing route, login and role revocation checked; Horizon cold/warm JWT authentication checked.\n";
foreach ($errors as $error) echo $error . "\n";
exit($errors ? 1 : 0);
