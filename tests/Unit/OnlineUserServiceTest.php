<?php

namespace Tests\Unit;

use App\Services\OnlineUserService;
use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Support\Facades\Facade;
use PHPUnit\Framework\TestCase;

class OnlineUserServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    public function test_empty_alive_report_resets_node_count_to_zero(): void
    {
        $container = new Container();
        $container->instance('config', new Repository(['v2board' => ['server_push_interval' => 60]]));
        $cache = new class {
            public $writes = [];

            public function put($key, $value, $ttl): void
            {
                $this->writes[$key] = [$value, $ttl];
            }
        };
        $container->instance('cache', $cache);
        Container::setInstance($container);
        Facade::setFacadeApplication($container);

        (new OnlineUserService())->report('v2node', 7, []);

        $this->assertSame(0, $cache->writes['SERVER_V2NODE_ONLINE_USER_7'][0]);
        $this->assertSame([], $cache->writes['SERVER_V2NODE_ONLINE_SNAPSHOT_7'][0]['user_ids']);
        $this->assertSame(180, $cache->writes['SERVER_V2NODE_ONLINE_SNAPSHOT_7'][1]);

        (new OnlineUserService())->report('v2node', 7, [1 => ['ip-a', 'ip-b'], 2 => [], 3 => ['ip-c']]);
        $this->assertSame(2, $cache->writes['SERVER_V2NODE_ONLINE_USER_7'][0]);
        $this->assertSame([1, 3], $cache->writes['SERVER_V2NODE_ONLINE_SNAPSHOT_7'][0]['user_ids']);
    }

    public function test_online_count_deduplicates_users_and_ignores_stale_snapshots(): void
    {
        $now = 1000;
        $snapshots = [
            ['reported_at' => 990, 'user_ids' => [1, 2]],
            ['reported_at' => 950, 'user_ids' => [2, 3]],
            ['reported_at' => 700, 'user_ids' => [4]],
            ['reported_at' => 999, 'user_ids' => []],
        ];

        $this->assertSame(3, OnlineUserService::countSnapshots($snapshots, $now, 180));
        $this->assertSame(0, OnlineUserService::countSnapshots([
            ['reported_at' => $now, 'user_ids' => []],
        ], $now, 180));
    }
}
