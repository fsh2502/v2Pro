<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class V2boardUpdate extends Command
{
    protected $signature = 'v2board:update {--check : Chỉ xem cấu trúc cần bổ sung} {--force : Thực hiện sau khi sao lưu database}';
    protected $description = 'Lệnh tương thích, dùng bộ nâng cấp database an toàn của v2Pro Pro';

    public function handle(): int
    {
        $arguments = $this->option('check') ? ['--check' => true] : ['--force' => (bool) $this->option('force')];
        return $this->call('v2board:db-upgrade', $arguments);
    }
}
