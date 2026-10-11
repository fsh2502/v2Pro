<?php

// Run with -d disable_functions=mb_split. No application providers or real database.
require __DIR__ . '/staff-bootstrap.php';
if (extension_loaded('mbstring') && function_exists('mb_split')) throw new RuntimeException('Test requires missing/disabled mb_split.');
$app = new Illuminate\Foundation\Application(dirname(__DIR__));
$db = new class {
    public bool $touched = false;
    public function connection() { $this->touched = true; throw new RuntimeException('Unexpected database access.'); }
};
$app->instance('db', $db);
Illuminate\Support\Facades\Facade::setFacadeApplication($app);
$command = new class extends App\Console\Commands\DatabaseUpgrade {
    public function option($key = null) { return $key === 'force'; }
};
$output = new Symfony\Component\Console\Output\BufferedOutput();
$command->setLaravel($app);
$command->setOutput(new Illuminate\Console\OutputStyle(new Symfony\Component\Console\Input\ArrayInput([]), $output));
$result = $command->handle(new App\Services\DatabaseUpgradeService());
if ($result !== 1 || $db->touched || !str_contains($output->fetch(), 'mb_split')) {
    throw new RuntimeException('Runtime guard did not stop before database access.');
}
echo "Direct database upgrade: missing mb_split rejected before database access PASS\n";
