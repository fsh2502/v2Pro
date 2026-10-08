<?php

namespace Tests\Feature;

use App\Console\Commands\V2boardInstall;
use App\Console\Commands\V2boardUpdate;
use Illuminate\Console\OutputStyle;
use Illuminate\Database\Query\Expression;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Mockery;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

class DeploymentCommandsTest extends TestCase
{
    private $app;
    private $output;
    private $schema;

    protected function setUp(): void
    {
        parent::setUp();
        Facade::clearResolvedInstances();
        $this->app = new Application(dirname(__DIR__, 2));
        foreach (['db', 'files', 'db.schema', \Illuminate\Contracts\Console\Kernel::class] as $binding) {
            $this->app->instance($binding, new \stdClass());
        }
        Facade::setFacadeApplication($this->app);
        foreach (['Artisan' => Artisan::class, 'File' => File::class, 'Schema' => Schema::class] as $alias => $class) {
            if (!class_exists($alias, false)) class_alias($class, $alias);
        }
        $this->schema = Mockery::mock();
        DB::shouldReceive('connection')->andReturn(new class($this->schema) {
            private $schema;
            public function __construct($schema) { $this->schema = $schema; }
            public function getPdo() {}
            public function getSchemaBuilder() { return $this->schema; }
        });
        DB::shouldReceive('raw')->andReturnUsing(function ($sql) { return new Expression($sql); });
        $this->output = new BufferedOutput();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    private function command($command)
    {
        $command->setLaravel($this->app);
        $command->setOutput(new OutputStyle(new ArrayInput([]), $this->output));
        return $command;
    }

    public function test_upgrade_executes_staff_statements_after_comments_and_checks_schema(): void
    {
        Artisan::shouldReceive('call')->once()->with('config:cache')->andReturn(0);
        Artisan::shouldReceive('call')->once()->with('horizon:terminate')->andReturn(0);
        File::shouldReceive('get')->once()->andReturn(file_get_contents(dirname(__DIR__, 2) . '/database/update.sql'));
        $statements = [];
        DB::shouldReceive('select')->andReturnUsing(function ($sql) use (&$statements) { $statements[] = trim((string) $sql); return []; });
        $this->schema->shouldReceive('hasColumn')->andReturn(true);
        $this->assertNull($this->command(new V2boardUpdate())->handle());
        $this->assertContains('ALTER TABLE `v2_user` ADD `staff_app_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL', $statements);
        $this->assertContains('ALTER TABLE `v2_user` ADD `staff_plan_id` int DEFAULT NULL', $statements);
        $journal = array_filter($statements, function ($sql) { return strpos($sql, 'CREATE TABLE IF NOT EXISTS `v2_staff_activity_log`') === 0; });
        $this->assertCount(1, $journal);
    }

    public function test_incomplete_upgrade_reports_failure_instead_of_success(): void
    {
        Artisan::shouldReceive('call')->once()->with('config:cache')->andReturn(0);
        Artisan::shouldReceive('call')->never()->with('horizon:terminate');
        File::shouldReceive('get')->once()->andReturn('-- journal' . "\n" . 'CREATE TABLE `v2_staff_activity_log` (id int);');
        DB::shouldReceive('select')->once()->andThrow(new \RuntimeException('Database write rejected'));
        $this->schema->shouldReceive('hasColumn')->andReturnUsing(function ($table) { return $table !== 'v2_staff_activity_log'; });
        $this->assertSame(1, $this->command(new V2boardUpdate())->handle());
        $output = $this->output->fetch();
        $this->assertStringContainsString('v2_staff_activity_log.id', $output);
        $this->assertStringNotContainsString('更新完毕', $output);
    }

    public function test_install_runs_first_statement_after_header_and_stops_on_sql_failure(): void
    {
        $scratch = dirname(__DIR__, 2) . '/artifacts/deployment-review/install-test';
        if (!is_dir($scratch)) mkdir($scratch, 0777, true);
        file_put_contents($scratch . '/.env.example', "APP_KEY=\nDB_HOST=\nDB_DATABASE=\nDB_USERNAME=\nDB_PASSWORD=\n");
        $this->app->setBasePath($scratch);
        $this->app->useEnvironmentPath($scratch);
        File::shouldReceive('exists')->once()->andReturn(false);
        File::shouldReceive('get')->once()->andReturn(file_get_contents(dirname(__DIR__, 2) . '/database/install.sql'));
        Artisan::shouldReceive('call')->once()->with('config:clear')->andReturn(0);
        Artisan::shouldReceive('call')->once()->with('config:cache')->andReturn(0);
        DB::shouldReceive('unprepared')->once()->with(Mockery::on(function ($sql) { return trim($sql) === 'SET NAMES utf8'; }))
            ->andThrow(new \RuntimeException('write denied'));
        $command = new class extends V2boardInstall {
            public function ask($question, $default = null) { return $default ?? 'isolated-test'; }
        };
        $this->assertSame(1, $this->command($command)->handle());
        $output = $this->output->fetch();
        $this->assertStringContainsString('write denied', $output);
        $this->assertStringNotContainsString('Mọi thứ đã sẵn sàng', $output);
    }
}
