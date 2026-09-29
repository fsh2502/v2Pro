<?php

namespace App\Services;

use App\Models\ServerAnytls;
use App\Models\ServerHysteria;
use App\Models\ServerShadowsocks;
use App\Models\ServerTrojan;
use App\Models\ServerTuic;
use App\Models\ServerV2node;
use App\Models\ServerVless;
use App\Models\ServerVmess;
use App\Utils\CacheKey;
use Illuminate\Support\Facades\Cache;

class OnlineUserService
{
    private const NODE_MODELS = [
        'ANYTLS' => ServerAnytls::class,
        'HYSTERIA' => ServerHysteria::class,
        'SHADOWSOCKS' => ServerShadowsocks::class,
        'TROJAN' => ServerTrojan::class,
        'TUIC' => ServerTuic::class,
        'V2NODE' => ServerV2node::class,
        'VLESS' => ServerVless::class,
        'VMESS' => ServerVmess::class,
    ];

    public static function snapshotKey(string $nodeType, int $nodeId): string
    {
        return 'SERVER_' . strtoupper($nodeType) . '_ONLINE_SNAPSHOT_' . $nodeId;
    }

    public static function maxAge(): int
    {
        return max(180, 3 * (int) config('v2board.server_push_interval', 60));
    }

    public function report(string $nodeType, int $nodeId, array $data): void
    {
        $type = strtoupper($nodeType);
        $userIds = [];
        foreach ($data as $id => $ips) {
            if (filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) !== false
                && is_array($ips) && count($ips) > 0) {
                $userIds[(int) $id] = (int) $id;
            }
        }

        $now = time();
        Cache::put(self::snapshotKey($type, $nodeId), [
            'user_ids' => array_values($userIds),
            'reported_at' => $now,
        ], self::maxAge());
        Cache::put(CacheKey::get("SERVER_{$type}_ONLINE_USER", $nodeId), count($userIds), self::maxAge());
        Cache::put(CacheKey::get("SERVER_{$type}_LAST_PUSH_AT", $nodeId), $now, 3600);
    }

    public function countAll(): int
    {
        $keys = [];
        foreach (self::NODE_MODELS as $type => $model) {
            foreach ($model::pluck('id') as $nodeId) {
                $keys[] = self::snapshotKey($type, (int) $nodeId);
            }
        }
        if (!$keys) {
            return 0;
        }

        return self::countSnapshots(Cache::many($keys), time(), self::maxAge());
    }

    public static function countSnapshots(array $snapshots, int $now, int $maxAge): int
    {
        $users = [];
        foreach ($snapshots as $snapshot) {
            if (!is_array($snapshot) || !isset($snapshot['reported_at'], $snapshot['user_ids'])
                || $snapshot['reported_at'] < $now - $maxAge || !is_array($snapshot['user_ids'])) {
                continue;
            }
            foreach ($snapshot['user_ids'] as $id) {
                if (is_int($id) && $id > 0) {
                    $users[$id] = true;
                }
            }
        }
        return count($users);
    }
}
