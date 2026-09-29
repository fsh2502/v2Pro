<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class TrafficUpdate extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'traffic:update';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = '流量更新任务';

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        ini_set('memory_limit', -1);
        if (Redis::exists('traffic_reset_lock')) {
            return;
        }
        // MULTI/EXEC prevents a fetch job's HINCRBY from landing between HGETALL and DEL.
        $traffic = Redis::transaction(function ($redis) {
            $redis->hgetall('v2board_upload_traffic');
            $redis->del('v2board_upload_traffic');
            $redis->hgetall('v2board_download_traffic');
            $redis->del('v2board_download_traffic');
        });
        $uploads = $traffic[0] ?: [];
        $downloads = $traffic[2] ?: [];
        if (empty($uploads) && empty($downloads)) {
            return;
        }

        try {
            $users = User::whereIn('id', array_unique(array_merge(array_keys($uploads), array_keys($downloads))))->get(['id']);
            $time = time();
            $casesU = [];
            $casesD = [];
            $idList = [];

            foreach ($users as $user) {
                $upload = $uploads[$user->id] ?? 0;
                $download = $downloads[$user->id] ?? 0;

                $id = (int) $user->id;
                $casesU[] = "WHEN {$id} THEN " . (int) $upload;
                $casesD[] = "WHEN {$id} THEN " . (int) $download;
                $idList[] = $id;
            }
            if (empty($idList)) {
                return;
            }
            $idListStr = implode(',', $idList);
            $casesUStr = implode(' ', $casesU);
            $casesDStr = implode(' ', $casesD);
            $sql = "UPDATE v2_user SET u = u + CASE id {$casesUStr} END, d = d + CASE id {$casesDStr} END, t = {$time}, updated_at = {$time} WHERE id IN ({$idListStr})";
            DB::transaction(function () use ($sql) {
                DB::statement($sql);
            });
        } catch (\Exception $e) {
            // Add the snapshot back without overwriting reports received since the drain.
            Redis::transaction(function ($redis) use ($uploads, $downloads) {
                foreach ($uploads as $userId => $bytes) {
                    $redis->hincrby('v2board_upload_traffic', $userId, $bytes);
                }
                foreach ($downloads as $userId => $bytes) {
                    $redis->hincrby('v2board_download_traffic', $userId, $bytes);
                }
            });
            Log::error('流量更新失败: ' . $e->getMessage());
            return;
        }
    }
}
