<?php

// CI only: use an explicitly named, empty database; never load the site's .env.
$database = getenv('V2PRO_CI_DATABASE');
if (!$database || !preg_match('/^v2pro_ci_[a-z0-9_]+$/', $database)) {
    throw new RuntimeException('Requires an isolated V2PRO_CI_DATABASE beginning v2pro_ci_.');
}
require __DIR__ . '/staff-bootstrap.php';
$root = dirname(__DIR__);
$scratch = $root . '/artifacts/mysql-upgrade-ci';
if (!is_dir($scratch)) mkdir($scratch, 0755, true);
foreach (['APP_CONFIG_CACHE' => 'config', 'APP_SERVICES_CACHE' => 'services', 'APP_PACKAGES_CACHE' => 'packages', 'APP_ROUTES_CACHE' => 'routes'] as $key => $name) {
    putenv($key . '=artifacts/mysql-upgrade-ci/' . $name . '.php');
}
foreach (['APP_ENV' => 'testing', 'APP_KEY' => 'base64:' . base64_encode(str_repeat('k', 32)),
    'APP_DEBUG' => 'false', 'CACHE_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array',
    'LOG_CHANNEL' => 'errorlog', 'DB_CONNECTION' => 'mysql', 'DB_HOST' => getenv('V2PRO_CI_HOST') ?: '127.0.0.1',
    'DB_PORT' => getenv('V2PRO_CI_PORT') ?: '3306', 'DB_DATABASE' => $database,
    'DB_USERNAME' => getenv('V2PRO_CI_USERNAME') ?: 'root', 'DB_PASSWORD' => getenv('V2PRO_CI_PASSWORD') ?: '',
    'VIEW_COMPILED_PATH' => $scratch] as $key => $value) putenv($key . '=' . $value);
$app = require $root . '/bootstrap/app.php';
$app->useEnvironmentPath($scratch)->loadEnvironmentFrom('nonexistent-test.env');
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
config(['logging.default' => 'errorlog']);
$db = $app['db']->connection();
if ($db->getSchemaBuilder()->getTableListing() !== []) throw new RuntimeException('CI database must be empty; nothing was changed.');
$service = new App\Services\DatabaseUpgradeService();
$catalog = $service->catalog(file_get_contents($root . '/database/install.sql'));
foreach ($catalog as $table => $definition) {
    if (str_starts_with($table, 'v2_staff_')) continue;
    $parts = [];
    foreach ($definition['columns'] as $name => $column) {
        if (!str_starts_with($name, 'staff_')) $parts[] = $column['sql'];
    }
    foreach ($definition['indexes'] as $index) {
        if (!array_filter($index['columns'], fn ($column) => str_starts_with($column, 'staff_'))) $parts[] = $index['sql'];
    }
    $db->unprepared('CREATE TABLE `' . $table . '` (' . implode(', ', $parts) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}
$legacy = ['id' => 12, 'email' => 'legacy@example.com', 'password' => password_hash('ci-only-password', PASSWORD_DEFAULT),
    'uuid' => '11111111-1111-4111-8111-111111111111', 'token' => 'ci-token', 'balance' => 1234,
    'u' => 123, 'd' => 456, 'transfer_enable' => 987654321, 'created_at' => 1700000000, 'updated_at' => 1700000000];
$db->table('v2_user')->insert($legacy);
$before = (array) $db->table('v2_user')->where('id', 12)->first();
$steps = $service->plan($db, $catalog);
if (!$steps) throw new RuntimeException('Legacy fixture did not require upgrade.');
if ($kernel->call('v2board:db-upgrade', ['--check' => true]) !== 0 || $service->plan($db, $catalog) !== $steps) {
    throw new RuntimeException('Read-only check failed or modified schema.');
}
for ($run = 1; $run <= 2; $run++) {
    if ($kernel->call('v2board:db-upgrade', ['--force' => true]) !== 0) throw new RuntimeException($kernel->output());
    if ($service->plan($db, $catalog) !== []) throw new RuntimeException('Upgrade left missing structure.');
    $after = (array) $db->table('v2_user')->where('id', 12)->first();
    foreach ($before as $column => $value) {
        if ($after[$column] !== $value) throw new RuntimeException('Legacy value changed: ' . $column);
    }
    if ($db->table('v2_user')->count() !== 1) throw new RuntimeException('Legacy row count changed.');
}
$db->table('v2_user')->where('id', 12)->update(['staff_app_name' => 'CTV Việt 🌟', 'remarks' => 'Ghi chú 🌟']);
if ($db->table('v2_user')->where('id', 12)->value('staff_app_name') !== 'CTV Việt 🌟') throw new RuntimeException('Unicode did not round trip.');
echo "MySQL upgrade: read-only check, legacy preservation, migrations, replay and Unicode PASS\n";
