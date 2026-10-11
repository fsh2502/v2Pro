<?php

namespace App\Console\Commands;

use App\Services\DatabaseUpgradeService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class DatabaseUpgrade extends Command
{
    protected $signature = 'v2board:db-upgrade
        {--check : Xem các bảng, cột, index cần bổ sung, không ghi database}
        {--force : Thực hiện nâng cấp sau khi đã sao lưu database}
        {--diagnose : Hiện vị trí lỗi PHP, không hiện tham số hoặc dữ liệu truy vấn}';

    protected $description = 'Bổ sung cấu trúc database v2Pro cũ và chạy migration CTV, giữ dữ liệu hiện có';

    public function handle(DatabaseUpgradeService $upgrade): int
    {
        $db = null;
        $locked = false;
        try {
            if ($this->option('force') && !$this->option('check') &&
                (!extension_loaded('mbstring') || !function_exists('mb_split'))) {
                throw new RuntimeException('PHP CLI thiếu mbstring/mb_split (mbregex). Chưa ghi database. Cài/bật extension cho đúng PHP trước khi chạy lại.');
            }
            $db = DB::connection();
            if (!in_array($db->getDriverName(), ['mysql', 'mariadb'], true) || $db->getTablePrefix() !== '') {
                throw new RuntimeException('Lệnh này hỗ trợ MySQL/MariaDB với tên bảng v2Pro không có prefix tùy chỉnh.');
            }
            $catalog = $upgrade->catalog(file_get_contents(database_path('install.sql')));
            $this->info('Database đang kết nối: ' . $db->getDatabaseName());
            if (!$this->option('check') && !$this->option('force')) {
                $this->error('Dùng --check để xem trước, hoặc --force để thực hiện sau khi đã sao lưu database.');
                return self::FAILURE;
            }
            $lock = 'v2pro-db-upgrade-' . substr(hash('sha256', $db->getDatabaseName()), 0, 32);
            if (!$this->option('check')) {
                $result = $db->selectOne('SELECT GET_LOCK(?, 0) AS acquired', [$lock], false);
                if ((int) ($result->acquired ?? 0) !== 1) throw new RuntimeException('Một tiến trình nâng cấp database khác đang chạy.');
                $locked = true;
            }
            $steps = $upgrade->plan($db, $catalog);
            foreach ($steps as $step) $this->line($step['label']);
            $this->info(count($steps) . ' thay đổi cấu trúc cần bổ sung.');
            if ($this->option('check')) {
                $this->line('Chỉ đọc: chưa thay đổi database. Khi thực hiện, lệnh còn chạy migration trong database/migrations (bao gồm hỗ trợ Unicode cho CTV).');
                return self::SUCCESS;
            }
            $this->warn('DDL MySQL có thể tự commit. Nếu bị gián đoạn, giữ bản sao lưu và chạy lại sau khi xử lý nguyên nhân.');
            foreach ($steps as $step) {
                if (!$db->statement($step['sql'])) throw new RuntimeException('Không thực hiện được: ' . $step['label']);
                $this->info('Đã thực hiện: ' . $step['label']);
            }
            if ($this->call('migrate', ['--force' => true, '--path' => 'database/migrations']) !== self::SUCCESS) {
                throw new RuntimeException('Migration chưa hoàn tất. Không chuyển website sang bản mới trước khi xử lý lỗi.');
            }
            if ($upgrade->plan($db, $catalog)) throw new RuntimeException('Cấu trúc sau nâng cấp vẫn còn thiếu; cần kiểm tra lại.');
            $this->info('Hoàn tất: các bảng, cột và index tham chiếu đã có, migration đã chạy. Dữ liệu và cấu hình cũ được giữ nguyên.');
            return self::SUCCESS;
        } catch (Throwable $e) {
            $message = 'Nâng cấp thất bại (' . get_class($e) . '). Dùng --diagnose để xem vị trí lỗi; không xóa hoặc nhập lại database.';
            if (get_class($e) === RuntimeException::class ||
                ($e instanceof \Error && preg_match('/^Call to undefined (?:function|method) [a-zA-Z0-9_\\\\:]+\(\)$/', $e->getMessage()))) {
                $message = $e->getMessage();
            }
            $this->error($message);
            if ($this->option('diagnose')) {
                // Deliberately omit exception arguments and SQL/connection messages.
                $this->line('Vị trí lỗi: ' . $e->getFile() . ':' . $e->getLine());
                foreach (array_slice($e->getTrace(), 0, 6) as $frame) {
                    $this->line(($frame['file'] ?? '(nội bộ)') . ':' . ($frame['line'] ?? 0) . ' ' .
                        ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? '') . '()');
                }
            }
            return self::FAILURE;
        } finally {
            if ($locked) {
                try { $db->selectOne('SELECT RELEASE_LOCK(?)', [$lock], false); }
                catch (Throwable $e) { $this->warn('Không xác nhận được giải phóng khóa; khóa tự giải phóng khi kết nối đóng.'); }
            }
        }
    }
}
