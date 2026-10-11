<?php

namespace Tests\Feature;

use App\Http\Controllers\V1\User\UserController;
use App\Models\User;
use Illuminate\Config\Repository;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use PHPUnit\Framework\TestCase;

class IosGlassSubscriptionTest extends TestCase
{
    private $app;

    protected function setUp(): void
    {
        Facade::clearResolvedInstances();
        $this->app = new Application(dirname(__DIR__, 2));
        $this->app->instance('request', Request::create('http://localhost'));
        $this->app->instance('config', new Repository([
            'app' => ['url' => 'http://localhost'],
            'v2board' => ['app_name' => 'Panel gốc', 'subscribe_url' => ''],
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
            'cache' => ['default' => 'array', 'stores' => ['array' => ['driver' => 'array']]],
            'view' => ['paths' => [], 'compiled' => sys_get_temp_dir()],
        ]));
        Facade::setFacadeApplication($this->app);
        foreach ([\Illuminate\Events\EventServiceProvider::class,
            \Illuminate\Routing\RoutingServiceProvider::class,
            \Illuminate\Database\DatabaseServiceProvider::class,
            \Illuminate\Filesystem\FilesystemServiceProvider::class,
            \Illuminate\View\ViewServiceProvider::class,
            \Illuminate\Cache\CacheServiceProvider::class] as $provider) $this->app->register($provider);
        $this->app->boot();
        DB::getSchemaBuilder()->create('v2_user', function (Blueprint $table) {
            $table->increments('id'); $table->string('email'); $table->string('token')->nullable(); $table->string('uuid')->nullable();
            $table->integer('is_admin')->default(0); $table->integer('is_staff')->default(0);
            $table->integer('staff_owner_id')->nullable(); $table->integer('staff_plan_id')->nullable(); $table->string('staff_app_name')->nullable();
            $table->integer('plan_id')->nullable(); $table->integer('expired_at')->nullable();
            $table->bigInteger('u')->default(0); $table->bigInteger('d')->default(0); $table->bigInteger('transfer_enable')->default(0);
            $table->integer('device_limit')->nullable(); $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        DB::getSchemaBuilder()->create('v2_staff_plan', function (Blueprint $table) {
            $table->increments('id'); $table->string('name'); $table->integer('transfer_enable'); $table->integer('group_id');
        });
    }

    protected function tearDown(): void { Facade::clearResolvedInstances(); parent::tearDown(); }

    private function subscription(User $user): array
    {
        $request = Request::create('http://localhost/api/v1/user/getSubscribe');
        $request->merge(['user' => ['id' => $user->id]]);
        return json_decode((new UserController())->getSubscribe($request)->getContent(), true)['data'];
    }

    public function test_customer_import_name_tracks_current_staff_owner_without_exposing_plan_settings(): void
    {
        $a = User::create(['email' => 'a@example.com', 'is_staff' => 1, 'staff_app_name' => 'Mạng A 🌟']);
        $b = User::create(['email' => 'b@example.com', 'is_staff' => 1, 'staff_app_name' => 'Mạng B']);
        DB::table('v2_staff_plan')->insert(['id' => 7, 'name' => 'Gói CTV 100 GB', 'transfer_enable' => 100, 'group_id' => 22]);
        $customer = User::create(['email' => 'customer@example.com', 'staff_owner_id' => $a->id, 'staff_plan_id' => 7, 'token' => 'synthetic']);
        $data = $this->subscription($customer);
        $this->assertSame('Mạng A 🌟', $data['profile_name']);
        $this->assertSame(['name' => 'Gói CTV 100 GB'], $data['staff_plan']);
        $this->assertStringContainsString('token=synthetic', $data['subscribe_url']);
        $customer->update(['staff_owner_id' => $b->id]);
        $this->assertSame('Mạng B', $this->subscription($customer)['profile_name']);
        $b->update(['is_staff' => 0]);
        $this->assertSame('Panel gốc', $this->subscription($customer)['profile_name']);
        $this->assertSame('Panel gốc', config('v2board.app_name'));
    }

    public function test_unassigned_customer_keeps_global_name_and_missing_staff_plan_is_safe(): void
    {
        $customer = User::create(['email' => 'normal@example.com', 'token' => 'synthetic', 'staff_plan_id' => 999]);
        $data = $this->subscription($customer);
        $this->assertSame('Panel gốc', $data['profile_name']);
        $this->assertNull($data['staff_plan']);
    }

    public function test_subscription_titles_preserve_flags_and_unicode_as_ascii_safe_headers(): void
    {
        $renderers = [
            \App\Protocols\Hiddify::class,
            \App\Protocols\Singbox\Singbox::class,
            \App\Protocols\Singbox\SingboxOld::class,
            \App\Protocols\General::class,
            \App\Protocols\Happ::class,
            \App\Protocols\v2RayTun::class,
            \App\Protocols\V2BOX::class,
        ];
        $user = ['uuid' => '00000000-0000-0000-0000-000000000001', 'u' => 0, 'd' => 0,
            'transfer_enable' => 1073741824, 'expired_at' => null];
        foreach (['🇯🇵SHOPTUANTRUONG🇻🇳', '👩🏽‍💻 Mạng Việt ❤️', 'A & # / + % ? = "B"', 'base64:abc', 'Plain ASCII'] as $name) {
            config(['v2board.app_name' => $name]);
            foreach ($renderers as $renderer) {
                $response = (new $renderer($user, []))->handle();
                $header = $response->headers->get('profile-title');
                $this->assertDoesNotMatchRegularExpression('/[^\x20-\x7E]/', $header, $renderer);
                $decoded = str_starts_with($header, 'base64:') ? base64_decode(substr($header, 7), true) : $header;
                $this->assertSame($name, $decoded, $renderer);
                $disposition = $response->headers->get('content-disposition');
                $this->assertStringStartsWith("attachment; filename*=UTF-8''", $disposition, $renderer);
                $this->assertSame($name, rawurldecode(substr($disposition, strlen("attachment; filename*=UTF-8''"))), $renderer);
            }
        }
    }

    public function test_limited_profile_titles_do_not_split_flag_pairs_or_joined_emoji(): void
    {
        $user = ['uuid' => '00000000-0000-0000-0000-000000000001', 'u' => 0, 'd' => 0,
            'transfer_enable' => 1073741824, 'expired_at' => null];
        foreach (['🇻🇳', '👩🏽‍💻', "e\u{0301}", '❤️'] as $cluster) {
            config(['v2board.app_name' => str_repeat('A', 24) . $cluster]);
            foreach ([\App\Protocols\Happ::class, \App\Protocols\V2BOX::class] as $renderer) {
                $response = (new $renderer($user, []))->handle();
                $this->assertSame(str_repeat('A', 24), $response->headers->get('profile-title'), $renderer);
            }
        }
    }
}
