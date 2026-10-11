<?php

namespace Tests\Feature;

use App\Console\Commands\DatabaseUpgrade;
use App\Services\DatabaseUpgradeService;
use Illuminate\Config\Repository;
use Illuminate\Console\OutputStyle;
use Illuminate\Database\Connection;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Mockery;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

class DatabaseUpgradeTest extends TestCase
{
    private Application $app;
    private DatabaseUpgradeService $service;

    protected function setUp(): void
    {
        Facade::clearResolvedInstances();
        $this->app = new Application(dirname(__DIR__, 2));
        $this->app->instance('config', new Repository([
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
        ]));
        Facade::setFacadeApplication($this->app);
        $this->app->register(\Illuminate\Events\EventServiceProvider::class);
        $this->app->register(\Illuminate\Database\DatabaseServiceProvider::class);
        $this->app->boot();
        $this->service = new DatabaseUpgradeService();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    private function legacy(): Connection
    {
        $db = DB::connection();
        $db->getSchemaBuilder()->create('v2_user', function (Blueprint $table) {
            $table->increments('id'); $table->string('email')->unique(); $table->string('password');
            $table->text('remarks')->nullable();
        });
        foreach (['v2_order', 'v2_plan'] as $table) {
            $db->getSchemaBuilder()->create($table, fn (Blueprint $blueprint) => $blueprint->increments('id'));
        }
        $db->table('v2_user')->insert(['id' => 12, 'email' => 'existing@example.test', 'password' => 'existing-hash', 'remarks' => 'Dữ liệu cũ 🌟']);
        $db->table('v2_order')->insert(['id' => 42]);
        return $db;
    }

    private function reference(string $extra = ''): array
    {
        // MySQL catalog with portable definitions so plan execution can be tested on isolated SQLite.
        return $this->service->catalog("CREATE TABLE `v2_user` (
            `id` integer NOT NULL, `email` varchar(64) NOT NULL, `password` varchar(64) NOT NULL,
            `remarks` text, `staff_owner_id` integer DEFAULT NULL,
            `staff_customer_limit` integer NOT NULL DEFAULT 0,
            PRIMARY KEY (`id`), UNIQUE KEY `email` (`email`), KEY `staff_owner` (`staff_owner_id`)
        ) ENGINE=InnoDB;
        CREATE TABLE `v2_order` (`id` integer NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;
        CREATE TABLE `v2_plan` (`id` integer NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;
        CREATE TABLE `v2_staff_plan` (`id` integer NOT NULL, `name` varchar(128) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;
        CREATE TABLE `v2_staff_activity_log` (`id` integer NOT NULL, `changes` text NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB;
        {$extra}");
    }

    public function test_reference_reads_all_real_tables_but_never_imports_dump_data_or_destructive_sql(): void
    {
        $catalog = $this->service->catalog(file_get_contents(database_path('install.sql')));
        $this->assertCount(31, $catalog);
        $this->assertCount(39, $catalog['v2_user']['columns']);
        $this->assertArrayHasKey('v2_server_anytls', $catalog);
        $this->assertArrayHasKey('staff_creator_id', $catalog['v2_user']['columns']);
        $this->assertTrue($catalog['v2_user']['columns']['staff_customer_limit']['default']);
        foreach ($catalog as $table) $this->assertStringStartsWith('CREATE TABLE', $table['sql']);
        $custom = $this->reference("DROP TABLE `v2_user`; INSERT INTO `v2_user` VALUES ('no'); UPDATE `v2_user` SET `password`='no';
            CREATE TABLE `custom` (`id` int, `value` varchar(128) DEFAULT 'a;b,c' COMMENT 'NOT NULL, DEFAULT; words', PRIMARY KEY (`id`)) ENGINE=InnoDB;");
        $this->assertSame("`value` varchar(128) DEFAULT 'a;b,c' COMMENT 'NOT NULL, DEFAULT; words'", $custom['custom']['columns']['value']['sql']);
        $this->assertFalse($custom['custom']['columns']['value']['required']);
    }

    public function test_plan_and_repeated_execution_preserve_legacy_rows_and_custom_schema(): void
    {
        $db = $this->legacy();
        $db->getSchemaBuilder()->create('custom_table', fn (Blueprint $table) => $table->string('value'));
        $db->table('custom_table')->insert(['value' => 'keep']);
        $before = (array) $db->table('v2_user')->first();
        $catalog = $this->reference();
        $steps = $this->service->plan($db, $catalog);
        $this->assertCount(5, $steps);
        $this->assertFalse($db->getSchemaBuilder()->hasColumn('v2_user', 'staff_owner_id'));
        foreach ($steps as $step) {
            if (str_starts_with($step['label'], 'Thêm index')) {
                $db->getSchemaBuilder()->table('v2_user', fn (Blueprint $table) => $table->index('staff_owner_id', 'staff_owner'));
            } else {
                $db->statement(preg_replace('/\s+ENGINE=InnoDB$/', '', $step['sql']));
            }
        }
        $after = (array) $db->table('v2_user')->first();
        $this->assertSame($before, array_intersect_key($after, $before));
        $this->assertNull($after['staff_owner_id']);
        $this->assertSame(0, $after['staff_customer_limit']);
        $this->assertSame(42, $db->table('v2_order')->value('id'));
        $this->assertSame('keep', $db->table('custom_table')->value('value'));
        $this->assertSame([], $this->service->plan($db, $catalog));
    }

    public function test_missing_required_column_on_populated_table_stops_before_any_write(): void
    {
        $db = $this->legacy();
        $catalog = $this->reference();
        $catalog['v2_user']['columns']['uuid'] = ['sql' => '`uuid` varchar(36) NOT NULL', 'required' => true, 'default' => false, 'auto' => false];
        try {
            $this->service->plan($db, $catalog);
            $this->fail('Expected preflight failure');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('v2_user.uuid', $e->getMessage());
            $this->assertFalse($db->getSchemaBuilder()->hasColumn('v2_user', 'staff_owner_id'));
            $this->assertFalse($db->getSchemaBuilder()->hasTable('v2_staff_plan'));
        }
    }

    public function test_duplicate_unique_values_are_detected_without_deleting_rows(): void
    {
        $db = $this->legacy();
        $db->getSchemaBuilder()->create('duplicates', fn (Blueprint $table) => $table->string('code')->nullable());
        $db->table('duplicates')->insert([['code' => 'same'], ['code' => 'same']]);
        $catalog = $this->reference('CREATE TABLE `duplicates` (`code` varchar(32), UNIQUE KEY `code` (`code`)) ENGINE=InnoDB;');
        try {
            $this->service->plan($db, $catalog);
            $this->fail('Expected duplicate failure');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('duplicates.code', $e->getMessage());
            $this->assertSame(2, $db->table('duplicates')->count());
            $this->assertStringNotContainsString('same', $e->getMessage());
        }
        $db->table('duplicates')->delete();
        $db->table('duplicates')->insert([['code' => null], ['code' => null]]);
        $this->assertNotEmpty($this->service->plan($db, $catalog));
    }

    public function test_empty_or_wrong_database_is_not_initialized_as_an_upgrade(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('v2_user');
        $this->service->plan(DB::connection(), $this->reference());
    }

    public function test_partial_upgrade_can_resume_without_recreating_completed_objects(): void
    {
        $db = $this->legacy();
        $catalog = $this->reference();
        $steps = $this->service->plan($db, $catalog);
        $db->statement($steps[0]['sql']);
        $remaining = $this->service->plan($db, $catalog);
        $this->assertCount(count($steps) - 1, $remaining);
        $this->assertNotContains($steps[0], $remaining);
        $this->assertSame('existing-hash', $db->table('v2_user')->value('password'));
    }

    public function test_conflicting_index_name_and_missing_auto_increment_are_not_repaired_blindly(): void
    {
        $db = $this->legacy();
        $db->getSchemaBuilder()->table('v2_user', fn (Blueprint $table) => $table->index('password', 'staff_owner'));
        try {
            $this->service->plan($db, $this->reference());
            $this->fail('Expected index conflict');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('staff_owner', $e->getMessage());
        }
        $catalog = $this->reference();
        $catalog['v2_user']['columns']['missing_id'] = ['sql' => '`missing_id` int AUTO_INCREMENT', 'required' => true, 'default' => false, 'auto' => true];
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('missing_id');
        $this->service->plan($db, $catalog);
    }

    public function test_unicode_migration_preflight_rejects_oversized_legacy_text_before_ddl(): void
    {
        $db = Mockery::mock(Connection::class);
        $schema = Mockery::mock(\Illuminate\Database\Schema\Builder::class);
        $query = Mockery::mock(\Illuminate\Database\Query\Builder::class);
        $db->shouldReceive('getSchemaBuilder')->andReturn($schema);
        $db->shouldReceive('getDriverName')->andReturn('mysql');
        $schema->shouldReceive('hasTable')->with('v2_user')->andReturn(true);
        $schema->shouldReceive('hasTable')->with('v2_order')->andReturn(true);
        $schema->shouldReceive('hasTable')->with('v2_plan')->andReturn(true);
        $schema->shouldReceive('hasColumns')->andReturn(true);
        $schema->shouldReceive('hasTable')->with('migrations')->andReturn(false);
        $schema->shouldReceive('hasColumn')->with('v2_user', 'staff_app_name')->andReturn(true);
        $db->shouldReceive('table')->with('v2_user')->andReturn($query);
        $db->shouldNotReceive('statement');
        $query->shouldReceive('useWritePdo')->andReturnSelf();
        $query->shouldReceive('whereRaw')->with('CHAR_LENGTH(`staff_app_name`) > 64')->andReturnSelf();
        $query->shouldReceive('exists')->andReturn(true);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('v2_user.staff_app_name');
        $this->service->plan($db, $this->reference());
    }

    private function command(array $options, int $migrationResult = 0): array
    {
        $command = new class($options, $migrationResult) extends DatabaseUpgrade {
            public array $calls = [];
            public function __construct(private array $flags, private int $migrationResult) { parent::__construct(); }
            public function option($key = null) { return $this->flags[$key] ?? false; }
            public function call($command, array $arguments = []) { $this->calls[] = [$command, $arguments]; return $this->migrationResult; }
        };
        $output = new BufferedOutput();
        $command->setLaravel($this->app);
        $command->setOutput(new OutputStyle(new ArrayInput([]), $output));
        return [$command, $output];
    }

    private function connection(): Connection
    {
        $db = Mockery::mock(Connection::class);
        $db->shouldReceive('getDriverName')->andReturn('mysql');
        $db->shouldReceive('getTablePrefix')->andReturn('');
        $db->shouldReceive('getDatabaseName')->andReturn('isolated-database');
        DB::shouldReceive('connection')->andReturn($db);
        return $db;
    }

    public function test_check_only_does_not_lock_write_or_run_migrations(): void
    {
        $db = $this->connection();
        $db->shouldNotReceive('statement'); $db->shouldNotReceive('selectOne');
        $service = Mockery::mock(DatabaseUpgradeService::class)->makePartial();
        $service->shouldReceive('plan')->once()->with($db, Mockery::type('array'))->andReturn([['label' => 'Tạo bảng v2_staff_plan', 'sql' => 'CREATE TABLE test (id int)']]);
        [$command, $output] = $this->command(['check' => true, 'force' => true]);
        $this->assertSame(0, $command->handle($service));
        $this->assertSame([], $command->calls);
        $this->assertStringContainsString('Chỉ đọc', $output->fetch());
    }

    public function test_default_requires_explicit_mode_and_does_not_write(): void
    {
        $db = $this->connection();
        $db->shouldNotReceive('statement'); $db->shouldNotReceive('selectOne');
        [$command] = $this->command([]);
        $this->assertSame(1, $command->handle($this->service));
        $this->assertSame([], $command->calls);
    }

    public function test_upgrade_runs_migrations_verifies_schema_and_releases_lock_on_primary(): void
    {
        $db = $this->connection();
        $db->shouldReceive('selectOne')->once()->with('SELECT GET_LOCK(?, 0) AS acquired', Mockery::type('array'), false)->andReturn((object) ['acquired' => 1]);
        $db->shouldReceive('selectOne')->once()->with('SELECT RELEASE_LOCK(?)', Mockery::type('array'), false)->andReturn((object) ['released' => 1]);
        $db->shouldReceive('statement')->once()->with('CREATE TABLE test (id int)')->andReturn(true);
        $service = Mockery::mock(DatabaseUpgradeService::class)->makePartial();
        $service->shouldReceive('plan')->twice()->andReturn([['label' => 'Tạo bảng test', 'sql' => 'CREATE TABLE test (id int)']], []);
        [$command, $output] = $this->command(['force' => true]);
        $this->assertSame(0, $command->handle($service));
        $this->assertSame([['migrate', ['--force' => true, '--path' => 'database/migrations']]], $command->calls);
        $this->assertStringContainsString('Hoàn tất', $output->fetch());
    }

    public function test_failure_stops_and_releases_lock_without_reporting_success(): void
    {
        $db = $this->connection();
        $db->shouldReceive('selectOne')->with('SELECT GET_LOCK(?, 0) AS acquired', Mockery::type('array'), false)->andReturn((object) ['acquired' => 1]);
        $db->shouldReceive('selectOne')->once()->with('SELECT RELEASE_LOCK(?)', Mockery::type('array'), false)->andReturn((object) ['released' => 1]);
        $db->shouldReceive('statement')->once()->andThrow(new RuntimeException('DDL denied'));
        $service = Mockery::mock(DatabaseUpgradeService::class)->makePartial();
        $service->shouldReceive('plan')->once()->andReturn([['label' => 'Tạo bảng test', 'sql' => 'CREATE TABLE test (id int)']]);
        [$command, $output] = $this->command(['force' => true]);
        $this->assertSame(1, $command->handle($service));
        $this->assertSame([], $command->calls);
        $this->assertStringNotContainsString('Hoàn tất', $output->fetch());
    }

    public function test_lock_contention_and_migration_failure_return_failure(): void
    {
        $db = $this->connection();
        $db->shouldReceive('selectOne')->once()->with('SELECT GET_LOCK(?, 0) AS acquired', Mockery::type('array'), false)->andReturn((object) ['acquired' => 0]);
        $db->shouldNotReceive('statement');
        [$command] = $this->command(['force' => true]);
        $this->assertSame(1, $command->handle($this->service));
        $db->shouldReceive('selectOne')->once()->with('SELECT GET_LOCK(?, 0) AS acquired', Mockery::type('array'), false)->andReturn((object) ['acquired' => 1]);
        $db->shouldReceive('selectOne')->once()->with('SELECT RELEASE_LOCK(?)', Mockery::type('array'), false)->andReturn((object) ['released' => 1]);
        $service = Mockery::mock(DatabaseUpgradeService::class)->makePartial();
        $service->shouldReceive('plan')->once()->andReturn([]);
        [$command, $output] = $this->command(['force' => true], 1);
        $this->assertSame(1, $command->handle($service));
        $this->assertStringNotContainsString('Hoàn tất', $output->fetch());
    }

    public function test_migration_php_error_is_diagnosable_and_lock_is_released_without_exposing_arguments(): void
    {
        $db = $this->connection();
        $db->shouldReceive('selectOne')->once()->with('SELECT GET_LOCK(?, 0) AS acquired', Mockery::type('array'), false)->andReturn((object) ['acquired' => 1]);
        $db->shouldReceive('selectOne')->once()->with('SELECT RELEASE_LOCK(?)', Mockery::type('array'), false)->andReturn((object) ['released' => 1]);
        $db->shouldNotReceive('statement');
        $service = Mockery::mock(DatabaseUpgradeService::class)->makePartial();
        $service->shouldReceive('plan')->once()->andReturn([]);
        $command = new class extends DatabaseUpgrade {
            public function option($key = null) { return in_array($key, ['force', 'diagnose'], true); }
            public function call($command, array $arguments = []) { $this->failMigration('private-password-marker'); }
            private function failMigration(string $secret): void { throw new \Error('Call to undefined function Illuminate\\Support\\missing_function()'); }
        };
        $output = new BufferedOutput();
        $command->setLaravel($this->app);
        $command->setOutput(new OutputStyle(new ArrayInput([]), $output));
        $this->assertSame(1, $command->handle($service));
        $text = $output->fetch();
        $this->assertStringContainsString('missing_function()', $text);
        $this->assertStringContainsString('Vị trí lỗi:', $text);
        $this->assertStringNotContainsString('private-password-marker', $text);
        $this->assertStringNotContainsString('Hoàn tất', $text);
    }

    public function test_database_exception_details_are_not_exposed_by_diagnose(): void
    {
        $db = $this->connection();
        $db->shouldReceive('selectOne')->with('SELECT GET_LOCK(?, 0) AS acquired', Mockery::type('array'), false)->andReturn((object) ['acquired' => 1]);
        $db->shouldReceive('selectOne')->once()->with('SELECT RELEASE_LOCK(?)', Mockery::type('array'), false)->andReturn((object) ['released' => 1]);
        $db->shouldReceive('statement')->once()->andThrow(new \PDOException('SQL with private-customer-marker'));
        $service = Mockery::mock(DatabaseUpgradeService::class)->makePartial();
        $service->shouldReceive('plan')->once()->andReturn([['label' => 'Tạo bảng test', 'sql' => 'CREATE TABLE test (id int)']]);
        [$command, $output] = $this->command(['force' => true, 'diagnose' => true]);
        $this->assertSame(1, $command->handle($service));
        $text = $output->fetch();
        $this->assertStringContainsString('Vị trí lỗi:', $text);
        $this->assertStringNotContainsString('private-customer-marker', $text);
        $this->assertStringNotContainsString('Hoàn tất', $text);
    }
}
