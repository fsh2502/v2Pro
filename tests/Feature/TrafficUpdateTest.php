<?php

namespace Tests\Feature;

use App\Console\Commands\TrafficUpdate;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Mockery;
use PHPUnit\Framework\TestCase;

class TrafficUpdateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $container = new Container();
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        $database = new Capsule($container);
        $database->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
        $database->setAsGlobal();
        $database->bootEloquent();
        $container->instance('db', $database->getDatabaseManager());
        $container->instance('redis', new \stdClass());
        $container->instance('log', new \stdClass());
        $database->schema()->create('v2_user', function (Blueprint $table) {
            $table->increments('id');
            $table->bigInteger('u');
            $table->bigInteger('d');
            $table->bigInteger('t')->nullable();
            $table->bigInteger('updated_at')->nullable();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    public function test_upload_only_and_download_only_users_are_updated_without_losing_new_reports(): void
    {
        DB::table('v2_user')->insert([
            ['id' => 1, 'u' => 10, 'd' => 20],
            ['id' => 2, 'u' => 30, 'd' => 40],
        ]);
        $hashes = [
            'v2board_upload_traffic' => [1 => 7],
            'v2board_download_traffic' => [2 => 9],
        ];
        $this->mockTrafficRedis($hashes, function (&$hashes) {
            $hashes['v2board_upload_traffic'][1] = 3;
        });

        (new TrafficUpdate())->handle();

        $this->assertSame(17, (int) DB::table('v2_user')->where('id', 1)->value('u'));
        $this->assertSame(20, (int) DB::table('v2_user')->where('id', 1)->value('d'));
        $this->assertSame(30, (int) DB::table('v2_user')->where('id', 2)->value('u'));
        $this->assertSame(49, (int) DB::table('v2_user')->where('id', 2)->value('d'));
        $this->assertSame([1 => 3], $hashes['v2board_upload_traffic']);
    }

    public function test_failed_database_update_restores_drained_traffic_alongside_new_reports(): void
    {
        DB::table('v2_user')->insert(['id' => 1, 'u' => 10, 'd' => 20]);
        DB::statement("CREATE TRIGGER reject_traffic_update BEFORE UPDATE ON v2_user BEGIN SELECT RAISE(ABORT, 'write failed'); END");
        $hashes = [
            'v2board_upload_traffic' => [1 => 7],
            'v2board_download_traffic' => [],
        ];
        $this->mockTrafficRedis($hashes, function (&$hashes) {
            $hashes['v2board_upload_traffic'][1] = 3;
        });
        Log::shouldReceive('error')->once();

        (new TrafficUpdate())->handle();

        $this->assertSame(10, (int) DB::table('v2_user')->where('id', 1)->value('u'));
        $this->assertSame([1 => 10], $hashes['v2board_upload_traffic']);
    }

    private function mockTrafficRedis(array &$hashes, callable $afterDrain): void
    {
        Redis::shouldReceive('exists')->once()->with('traffic_reset_lock')->andReturn(false);
        $transactionCount = 0;
        Redis::shouldReceive('transaction')->andReturnUsing(function ($callback) use (&$hashes, &$transactionCount, $afterDrain) {
            $transactionCount++;
            $queued = new class {
                public $commands = [];

                public function hgetall($key): void { $this->commands[] = ['hgetall', $key]; }
                public function del($key): void { $this->commands[] = ['del', $key]; }
                public function hincrby($key, $field, $amount): void { $this->commands[] = ['hincrby', $key, $field, $amount]; }
            };
            $callback($queued);

            $results = [];
            foreach ($queued->commands as $command) {
                [$method, $key] = $command;
                if ($method === 'hgetall') {
                    $results[] = $hashes[$key] ?? [];
                } elseif ($method === 'del') {
                    $results[] = !empty($hashes[$key]) ? 1 : 0;
                    $hashes[$key] = [];
                } else {
                    $field = $command[2];
                    $hashes[$key][$field] = ($hashes[$key][$field] ?? 0) + $command[3];
                    $results[] = $hashes[$key][$field];
                }
            }
            if ($transactionCount === 1) {
                $afterDrain($hashes);
            }
            return $results;
        });
    }
}
