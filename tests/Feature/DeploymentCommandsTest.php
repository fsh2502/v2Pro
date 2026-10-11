<?php

namespace Tests\Feature;

use App\Console\Commands\V2boardInstall;
use App\Console\Commands\V2boardUpdate;
use Illuminate\Console\OutputStyle;
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
        $this->app->instance('db.schema', $this->schema);
        DB::shouldReceive('connection')->andReturn(new class($this->schema) {
            private $schema;
            public function __construct($schema) { $this->schema = $schema; }
            public function getPdo() {}
            public function getDriverName() { return 'mysql'; }
            public function getSchemaBuilder() { return $this->schema; }
        });
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

    public function test_update_delegates_to_safe_upgrade_without_replaying_sql(): void
    {
        DB::shouldReceive('statement')->never();
        $command = new class extends V2boardUpdate {
            public array $calls = [];
            public function option($key = null) { return $key === 'force'; }
            public function call($command, array $arguments = []) { $this->calls[] = [$command, $arguments]; return 0; }
        };
        $this->assertSame(0, $this->command($command)->handle());
        $this->assertSame([['v2board:db-upgrade', ['--force' => true]]], $command->calls);
    }

    public function test_incomplete_upgrade_reports_failure_instead_of_success(): void
    {
        $command = new class extends V2boardUpdate {
            public function option($key = null) { return false; }
            public function call($command, array $arguments = []) { return 1; }
        };
        $this->assertSame(1, $this->command($command)->handle());
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
        $this->schema->shouldReceive('getTableListing')->once()->andReturn([]);
        DB::shouldReceive('unprepared')->once()->with(Mockery::on(function ($sql) { return trim($sql) === 'SET NAMES utf8'; }))
            ->andThrow(new \RuntimeException('write denied'));
        $command = new class extends V2boardInstall {
            public function ask($question, $default = null) { return $default ?? 'isolated-test'; }
            public function secret($question, $fallback = true) { return 'isolated-test-password'; }
        };
        $this->assertSame(1, $this->command($command)->handle());
        $output = $this->output->fetch();
        $this->assertStringContainsString('write denied', $output);
        $this->assertStringNotContainsString('Mọi thứ đã sẵn sàng', $output);
    }

    public function test_installer_refuses_existing_tables_before_importing_any_sql(): void
    {
        $scratch = dirname(__DIR__, 2) . '/artifacts/deployment-review/install-nonempty-test';
        if (!is_dir($scratch)) mkdir($scratch, 0777, true);
        file_put_contents($scratch . '/.env.example', "APP_KEY=\nDB_HOST=\nDB_DATABASE=\nDB_USERNAME=\nDB_PASSWORD=\n");
        $this->app->setBasePath($scratch);
        $this->app->useEnvironmentPath($scratch);
        File::shouldReceive('exists')->once()->andReturn(false);
        File::shouldReceive('get')->once()->andReturn(file_get_contents(dirname(__DIR__, 2) . '/database/install.sql'));
        Artisan::shouldReceive('call')->with('config:clear')->andReturn(0);
        Artisan::shouldReceive('call')->with('config:cache')->andReturn(0);
        $this->schema->shouldReceive('getTableListing')->once()->andReturn(['v2_user']);
        DB::shouldReceive('unprepared')->never();
        $command = new class extends V2boardInstall {
            public function ask($question, $default = null) { return $default ?? 'isolated-test'; }
            public function secret($question, $fallback = true) { return 'isolated-test-password'; }
        };
        $this->assertSame(1, $this->command($command)->handle());
        $this->assertStringContainsString('Database đã có bảng', $this->output->fetch());
    }
}
