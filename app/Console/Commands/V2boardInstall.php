<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use App\Models\User;
use App\Utils\Helper;
use App\Services\EnvironmentFileService;
use Illuminate\Support\Facades\DB;

class V2boardInstall extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'v2board:install';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cài mới v2Pro Pro trên database trống';

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
        try {
            $this->info("__     ______  ____                      _  ");
            $this->info("\ \   / /___ \| __ )  ___   __ _ _ __ __| | ");
            $this->info(" \ \ / /  __) |  _ \ / _ \ / _` | '__/ _` | ");
            $this->info("  \ V /  / __/| |_) | (_) | (_| | | | (_| | ");
            $this->info("   \_/  |_____|____/ \___/ \__,_|_|  \__,_| ");
            if (\File::exists(base_path() . '/.env')) {
                $securePath = config('v2board.secure_path', config('v2board.frontend_admin_path', hash('crc32b', config('app.key'))));
                $this->info("Truy cập http(s)://domain_của_bạn/{$securePath} Vào bảng quản trị, bạn có thể thay đổi mật khẩu trong trung tâm người dùng.");
                abort(500, 'Đã có .env. Dùng lệnh nâng cấp; không chạy installer trên website có dữ liệu.');
            }

            $previousMask = umask(0077);
            try {
                $copied = copy(base_path() . '/.env.example', base_path() . '/.env');
            } finally {
                umask($previousMask);
            }
            if (!$copied) {
                abort(500, 'Không thể sao chép tệp môi trường, vui lòng kiểm tra quyền thư mục');
            }
            $this->saveToEnv([
                'APP_KEY' => 'base64:' . base64_encode(Encrypter::generateKey('AES-256-CBC')),
                'DB_HOST' => $this->ask('Vui lòng nhập địa chỉ cơ sở dữ liệu (mặc định: localhost)', 'localhost'),
                'DB_DATABASE' => $this->ask('Tên cơ sở dữ liệu'),
                'DB_USERNAME' => $this->ask('Tên tài khoản database'),
                'DB_PASSWORD' => $this->secret('Mật khẩu database') ?? ''
            ]);
            \Artisan::call('config:clear');
            \Artisan::call('config:cache');
            try {
                DB::connection()->getPdo();
            } catch (\Exception $e) {
                abort(500, 'Kết nối cơ sở dữ liệu không thành công');
            }
            $file = \File::get(base_path() . '/database/install.sql');
            if (!in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
                throw new \RuntimeException('Cài mới cần MySQL/MariaDB.');
            }
            if (DB::connection()->getSchemaBuilder()->getTableListing() !== []) {
                throw new \RuntimeException('Database đã có bảng. Dừng cài mới để bảo vệ dữ liệu; dùng v2board:db-upgrade cho database v2Pro cũ.');
            }
            if (!$file) {
                abort(500, 'Tệp cơ sở dữ liệu không tồn tại');
            }
            // Keep line boundaries: flattening the dump turns -- comments into SQL.
            $sql = preg_replace('/^\h*(?:--\h|#)[^\r\n]*/m', '', $file);
            $sql = preg_split("/;/", $sql);
            if (!is_array($sql)) {
                abort(500, 'Định dạng tệp cơ sở dữ liệu không đúng');
            }
            $this->info('Đang nhập cơ sở dữ liệu, vui lòng đợi...');
            foreach ($sql as $item) {
                if (!trim($item)) continue;
                try {
                    DB::unprepared($item);
                } catch (\Exception $e) {
                    throw new \RuntimeException('Không thể nhập database: ' . $e->getMessage(), 0, $e);
                }
            }
            $this->info('Nhập cơ sở dữ liệu đã hoàn tất');
            $email = '';
            while (validator(['email' => $email], [
                'email' => ['bail', 'required', 'string', 'max:64', new \App\Rules\AccountEmail()]
            ])->fails()) {
                $email = $this->ask('Vui lòng nhập địa chỉ email của người quản trị?');
            }
            $password = Helper::guid(false);
            if (!$this->registerAdmin($email, $password)) {
                abort(500, 'Đăng ký tài khoản quản trị viên không thành công, vui lòng thử lại');
            }

            $this->info('Mọi thứ đã sẵn sàng');
            $this->info("Email quản trị viên：{$email}");
            $this->info("Mật khẩu quản trị viên:{$password}");

            $defaultSecurePath = hash('crc32b', config('app.key'));
            $this->info("Truy cập http(s)://domain_của_bạn/{$defaultSecurePath} Vào bảng quản trị, bạn có thể thay đổi mật khẩu trong trung tâm người dùng.");
        } catch (\Exception $e) {
            $this->error($e->getMessage());
            return 1;
        }
    }

    private function registerAdmin($email, $password)
    {
        $user = new User();
        $user->email = $email;
        if (strlen($password) < 8) {
            abort(500, 'Độ dài tối thiểu của mật khẩu quản trị viên là 8 ký tự');
        }
        $user->password = password_hash($password, PASSWORD_DEFAULT);
        $user->uuid = Helper::guid(true);
        $user->token = Helper::guid();
        $user->is_admin = 1;
        return $user->save();
    }

    private function saveToEnv($data = [])
    {
        (new EnvironmentFileService())->update(app()->environmentFilePath(), $data);
        return true;
    }
}
