<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class V2boardUpdate extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'v2board:update';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'v2board 更新';

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
        \Artisan::call('config:cache');
        DB::connection()->getPdo();
        $file = \File::get(base_path() . '/database/update.sql');
        if (!$file) {
            abort(500, '数据库文件不存在');
        }
        // Full-line dump comments must not hide the following ALTER/CREATE statement.
        $sql = preg_replace('/^\h*(?:--\h|#)[^\r\n]*/m', '', $file);
        $sql = preg_split("/;/", $sql);
        if (!is_array($sql)) {
            abort(500, '数据库文件格式有误');
        }
        $this->info('正在导入数据库请稍等...');
        foreach ($sql as $item) {
            if (!trim($item)) continue;
            try {
                DB::select(DB::raw($item));
            } catch (\Exception $e) {
                // Legacy SQL is replayed on every upgrade and can contain already
                // applied/removed objects. Keep that compatibility, but expose failures.
                $this->warn('SQL bỏ qua: ' . $e->getMessage());
            }
        }
        foreach ([
            'v2_user' => ['staff_owner_id', 'staff_creator_id', 'staff_customer_limit', 'staff_app_name', 'staff_plan_id'],
            'v2_notice' => ['staff_owner_id'],
            'v2_staff_plan' => ['id', 'name', 'group_id', 'transfer_enable', 'speed_limit', 'device_limit', 'enabled', 'created_at', 'updated_at'],
            'v2_staff_plan_permission' => ['staff_id', 'staff_plan_id'],
            'v2_staff_activity_log' => ['id', 'actor_id', 'actor_type', 'actor_label', 'target_type', 'target_id', 'target_label', 'staff_id', 'creator_id', 'action', 'changes', 'created_at'],
        ] as $table => $columns) {
            foreach ($columns as $column) {
                if (!\Schema::hasColumn($table, $column)) {
                    $this->error("Database chưa cập nhật đầy đủ: thiếu {$table}.{$column}. Hãy chạy php artisan migrate --force và kiểm tra lại.");
                    return 1;
                }
            }
        }
        \Artisan::call('horizon:terminate');
        $this->info('更新完毕，队列服务已重启，你无需进行任何操作。');
    }
}
