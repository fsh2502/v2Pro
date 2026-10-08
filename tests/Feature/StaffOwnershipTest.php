<?php

namespace Tests\Feature;

use App\Http\Routes\V1\StaffRoute;
use App\Models\Notice;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AuthService;
use App\Services\StaffCustomerService;
use App\Services\TelegramService;
use Illuminate\Config\Repository;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\HttpException;

class StaffOwnershipTest extends TestCase
{
    private $app;
    private $a;
    private $b;
    private $admin;
    private $owned;
    private $other;
    private $token;

    protected function setUp(): void
    {
        parent::setUp();
        Facade::clearResolvedInstances();
        $this->app = new Application(dirname(__DIR__, 2));
        $this->app->instance('request', Request::create('/'));
        $this->app->instance('config', new Repository([
            'app' => ['key' => str_repeat('k', 32), 'url' => 'http://localhost', 'debug' => false],
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
            'cache' => ['default' => 'array', 'stores' => ['array' => ['driver' => 'array']]],
            'view' => ['paths' => [dirname(__DIR__, 2) . '/resources/views'], 'compiled' => sys_get_temp_dir()],
            'v2board' => ['telegram_bot_enable' => 1]
        ]));
        Facade::setFacadeApplication($this->app);
        foreach ([
            \Illuminate\Events\EventServiceProvider::class,
            \Illuminate\Filesystem\FilesystemServiceProvider::class,
            \Illuminate\Routing\RoutingServiceProvider::class,
            \Illuminate\Database\DatabaseServiceProvider::class,
            \Illuminate\Cache\CacheServiceProvider::class,
            \Illuminate\Translation\TranslationServiceProvider::class,
            \Illuminate\Validation\ValidationServiceProvider::class,
            \Illuminate\View\ViewServiceProvider::class,
            \Illuminate\Foundation\Providers\FoundationServiceProvider::class
        ] as $provider) $this->app->register($provider);
        $this->app->boot();
        DB::connection()->getSchemaBuilder()->create('v2_user', function (Blueprint $table) {
            $table->increments('id');
            $table->string('email')->unique();
            $table->string('password')->default('hash');
            $table->string('password_algo')->nullable(); $table->string('password_salt')->nullable();
            $table->integer('is_admin')->default(0); $table->integer('is_staff')->default(0);
            $table->integer('banned')->default(0); $table->integer('staff_owner_id')->nullable()->index();
            $table->integer('staff_creator_id')->nullable()->index();
            $table->integer('staff_customer_limit')->default(0); $table->integer('telegram_id')->nullable();
            $table->integer('last_login_at')->nullable();
            $table->string('staff_app_name', 64)->nullable();
            $table->integer('invite_user_id')->nullable(); $table->integer('plan_id')->nullable(); $table->integer('group_id')->nullable();
            $table->bigInteger('transfer_enable')->default(0); $table->integer('device_limit')->nullable();
            $table->bigInteger('u')->default(0); $table->bigInteger('d')->default(0);
            $table->integer('speed_limit')->nullable();
            $table->integer('balance')->default(0); $table->integer('commission_balance')->default(0);
            $table->integer('commission_type')->default(0); $table->integer('commission_rate')->nullable();
            $table->integer('discount')->nullable();
            $table->bigInteger('expired_at')->nullable(); $table->string('remarks')->nullable();
            $table->string('uuid')->nullable(); $table->string('token')->nullable();
            $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        DB::connection()->getSchemaBuilder()->create('v2_ticket', function (Blueprint $table) {
            $table->increments('id'); $table->integer('user_id'); $table->string('subject');
            $table->integer('status')->default(0); $table->integer('reply_status')->default(0);
            $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        DB::connection()->getSchemaBuilder()->create('v2_ticket_message', function (Blueprint $table) {
            $table->increments('id'); $table->integer('ticket_id'); $table->integer('user_id'); $table->string('message');
            $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        DB::connection()->getSchemaBuilder()->create('v2_notice', function (Blueprint $table) {
            $table->increments('id'); $table->integer('staff_owner_id')->nullable(); $table->string('title');
            $table->string('content'); $table->integer('show')->default(0); $table->string('tags')->nullable();
            $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        DB::connection()->getSchemaBuilder()->create('v2_plan', function (Blueprint $table) {
            $table->increments('id'); $table->string('name'); $table->integer('sort')->default(0);
            $table->integer('group_id')->nullable(); $table->integer('transfer_enable')->default(10);
            $table->integer('device_limit')->nullable();
            $table->integer('speed_limit')->nullable();
        });
        DB::connection()->getSchemaBuilder()->create('v2_server_group', function (Blueprint $table) {
            $table->increments('id'); $table->string('name');
        });
        require_once dirname(__DIR__, 2) . '/database/migrations/2026_10_07_000003_add_staff_plans.php';
        (new \AddStaffPlans())->up();
        require_once dirname(__DIR__, 2) . '/database/migrations/2026_10_08_000000_add_staff_activity_log.php';
        (new \AddStaffActivityLog())->up();
        DB::table('v2_server_group')->insert([['id' => 1, 'name' => 'Staff servers A'], ['id' => 2, 'name' => 'Staff servers B']]);
        DB::connection()->getSchemaBuilder()->create('v2_order', function (Blueprint $table) {
            $table->increments('id'); $table->integer('user_id');
            $table->integer('plan_id')->nullable(); $table->integer('type')->nullable(); $table->string('period')->nullable();
            $table->integer('status')->default(0); $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        DB::connection()->getSchemaBuilder()->create('v2_invite_code', function (Blueprint $table) {
            $table->increments('id'); $table->integer('user_id');
        });
        DB::connection()->getSchemaBuilder()->create('v2_stat_user', function (Blueprint $table) {
            $table->increments('id'); $table->integer('user_id'); $table->bigInteger('u')->default(0);
            $table->bigInteger('d')->default(0); $table->integer('record_at'); $table->decimal('server_rate', 10, 2)->default(1);
        });
        $this->a = User::create(['email' => 'staff-a@example.com', 'is_staff' => 1, 'staff_customer_limit' => 2, 'telegram_id' => 101]);
        $this->b = User::create(['email' => 'staff-b@example.com', 'is_staff' => 1, 'staff_customer_limit' => 1, 'telegram_id' => 102]);
        $this->admin = User::create(['email' => 'admin@example.com', 'is_admin' => 1, 'telegram_id' => 103]);
        $this->owned = User::create(['email' => 'a-customer@example.com', 'staff_owner_id' => $this->a->id, 'staff_creator_id' => $this->a->id]);
        $this->other = User::create(['email' => 'b-customer@example.com', 'staff_owner_id' => $this->b->id, 'staff_creator_id' => $this->b->id]);
        User::create(['email' => 'unassigned@example.com']);
        $this->token = (new AuthService($this->a))->generateAuthData(Request::create('/'))['auth_data'];
        $router = $this->app['router'];
        $router->aliasMiddleware('staff', \App\Http\Middleware\Staff::class);
        $router->aliasMiddleware('admin', \App\Http\Middleware\Admin::class);
        $router->group(['prefix' => 'api/v1', 'namespace' => 'App\\Http\\Controllers'], function ($router) {
            (new StaffRoute())->map($router);
            $router->post('/staff-test-admin/user/update', 'V1\\Admin\\UserController@update')->middleware('admin');
            $router->post('/staff-test-admin/user/delUser', 'V1\\Admin\\UserController@delUser')->middleware('admin');
            $router->post('/staff-test-admin/user/allDel', 'V1\\Admin\\UserController@allDel')->middleware('admin');
            $router->post('/staff-test-admin/user/ban', 'V1\\Admin\\UserController@ban')->middleware('admin');
            $router->post('/staff-test-admin/user/resetSecret', 'V1\\Admin\\UserController@resetSecret')->middleware('admin');
            $router->get('/staff-test-admin/user/fetch', 'V1\\Admin\\UserController@fetch')->middleware('admin');
            $router->get('/staff-test-admin/user/getUserInfoById', 'V1\\Admin\\UserController@getUserInfoById')->middleware('admin');
            $router->get('/staff-test-admin/staff-plan/fetch', 'V1\\Admin\\StaffPlanController@fetch')->middleware('admin');
            $router->post('/staff-test-admin/staff-plan/save', 'V1\\Admin\\StaffPlanController@save')->middleware('admin');
            $router->post('/staff-test-admin/staff-plan/assign', 'V1\\Admin\\StaffPlanController@assign')->middleware('admin');
            $router->get('/staff-test-admin/ctv/activity', 'V1\\ActivityLogController@adminFetch')->middleware('admin');
            $router->get('/staff-test-admin/ctv/fetch', 'V1\\Admin\\CtvController@fetch')->middleware('admin');
            $router->get('/staff-test-admin/ctv/customers', 'V1\\Admin\\CtvController@customers')->middleware('admin');
            $router->post('/staff-test-admin/ctv/update', 'V1\\Admin\\CtvController@update')->middleware('admin');
            $router->post('/staff-test-admin/ctv/assign', 'V1\\Admin\\CtvController@assign')->middleware('admin');
        });
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    private function api($path, array $data = [], $method = 'GET', $token = null)
    {
        $request = Request::create($path[0] === '/' ? $path : '/api/v1/staff/' . $path, $method, $data);
        $request->headers->set('Accept', 'application/json');
        $request->headers->set('Authorization', $token ?? $this->token);
        $this->app->instance('request', $request);
        try {
            $response = $this->app['router']->dispatch($request);
            return [$response->getStatusCode(), json_decode($response->getContent(), true)];
        } catch (ValidationException $e) {
            return [422, $e->errors()];
        } catch (HttpException $e) {
            return [$e->getStatusCode(), ['message' => $e->getMessage()]];
        }
    }

    public function test_default_login_password_limit_counts_failures_and_blocks_after_five(): void
    {
        $this->owned->update(['password' => password_hash('correct-password', PASSWORD_DEFAULT)]);
        $controller = new \App\Http\Controllers\V1\Passport\AuthController();
        $key = \App\Utils\CacheKey::get('PASSWORD_ERROR_LIMIT', $this->owned->email);
        for ($attempt = 1; $attempt <= 6; $attempt++) {
            $request = \App\Http\Requests\Passport\AuthLogin::create('/', 'POST', ['email' => $this->owned->email, 'password' => 'wrong-password']);
            try {
                $controller->login($request);
                $this->fail('Wrong password must not log in.');
            } catch (HttpException $e) {
                $this->assertSame(500, $e->getStatusCode());
                if ($attempt === 6) $this->assertStringContainsString('too many password errors', $e->getMessage());
            }
            $this->assertSame(min(5, $attempt), Cache::get($key));
        }
    }

    public function test_admin_authorization_rechecks_current_role_ban_and_existence_after_cache_warmup(): void
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $path = '/api/v1/staff-test-admin/ctv/fetch';
        $this->assertSame(200, $this->api($path, [], 'GET', $token)[0]);
        $this->admin->update(['banned' => 1]);
        $this->assertSame(403, $this->api($path, [], 'GET', $token)[0]);
        $this->admin->update(['banned' => 0, 'is_admin' => 0]);
        $this->assertSame(403, $this->api($path, [], 'GET', $token)[0]);
        $this->admin->update(['is_admin' => 1]);
        $this->assertSame(200, $this->api($path, [], 'GET', $token)[0]);
        $this->admin->delete();
        $this->assertSame(403, $this->api($path, [], 'GET', $token)[0]);
    }

    public function test_activity_records_real_changes_and_redacts_credentials(): void
    {
        $this->assertSame(200, $this->api('user/update', ['id' => $this->owned->id, 'email' => $this->owned->email,
            'banned' => 0, 'transfer_enable' => 1073741824, 'password' => 'never-log-me', 'remarks' => '<script>alert(1)</script>',
            'user' => ['id' => $this->admin->id]], 'POST')[0]);
        [$status, $body] = $this->api('activity/fetch');
        $this->assertSame(200, $status); $this->assertSame(1, $body['total']);
        $row = $body['data'][0];
        $this->assertSame($this->a->id, $row['actor_id']); $this->assertSame('staff', $row['actor_type']);
        $this->assertSame(['before' => 0, 'after' => 1073741824], $row['changes']['transfer_enable']);
        $this->assertSame('Đã thay đổi', $row['changes']['password']['after']);
        $serialized = json_encode($row);
        $this->assertStringNotContainsString('never-log-me', $serialized);
        $this->assertStringNotContainsString($this->owned->fresh()->password, $serialized);
        $this->assertSame(200, $this->api('user/update', ['id' => $this->owned->id, 'email' => $this->owned->email,
            'banned' => 0, 'transfer_enable' => 1073741824], 'POST')[0]);
        $this->assertSame(1, $this->api('activity/fetch')[1]['total']);
        $this->assertSame(404, $this->api('user/update', ['id' => $this->other->id, 'email' => $this->other->email, 'banned' => 0], 'POST')[0]);
        $this->assertSame(1, $this->api('activity/fetch')[1]['total']);
        $this->assertSame(200, $this->api('user/resetSecret', ['id' => $this->owned->id, 'confirm' => 1], 'POST')[0]);
        $row = $this->api('activity/fetch')[1]['data'][0];
        $this->assertSame('customer.reset', $row['action']);
        $this->assertArrayNotHasKey('token', $row['changes']); $this->assertArrayNotHasKey('uuid', $row['changes']);
        (new StaffCustomerService())->updateByAdmin($this->owned->fresh(), ['device_limit' => 99, 'group_id' => 1, 'plan_id' => 321]);
        $row = $this->api('activity/fetch')[1]['data'][0];
        foreach (['device_limit', 'group_id', 'plan_id'] as $field) $this->assertArrayNotHasKey($field, $row['changes']);
        $this->assertSame(['before' => null, 'after' => 99], $this->ctvApi('activity')[1]['data'][0]['changes']['device_limit']);
    }

    public function test_activity_is_scoped_after_transfers_and_retained_after_deletion(): void
    {
        $tokenB = (new AuthService($this->b))->generateAuthData(Request::create('/'))['auth_data'];
        foreach ([[$this->owned, $this->token], [$this->other, $tokenB]] as [$user, $token]) {
            $this->assertSame(200, $this->api('user/update', ['id' => $user->id, 'email' => $user->email,
                'banned' => 0, 'remarks' => 'Private note ' . $user->id], 'POST', $token)[0]);
        }
        $this->assertSame(1, $this->api('activity/fetch', ['staff_id' => $this->b->id])[1]['total']);
        $this->assertSame(0, $this->api('activity/fetch', ['search' => $this->other->email])[1]['total']);
        $this->assertSame(403, $this->api('/api/v1/staff-test-admin/ctv/activity')[0]);
        $this->assertSame(2, $this->ctvApi('activity')[1]['total']);
        $this->b->update(['staff_customer_limit' => 2]);
        $this->assertSame(200, $this->ctvApi('assign', ['id' => $this->owned->id, 'staff_owner_id' => $this->b->id], 'POST')[0]);
        $this->assertSame(0, $this->api('activity/fetch')[1]['total']);
        $this->assertSame(1, $this->api('activity/fetch', [], 'GET', $tokenB)[1]['total']);
        $this->assertSame(200, $this->ctvApi('assign', ['id' => $this->owned->id, 'staff_owner_id' => $this->a->id], 'POST')[0]);
        $this->assertSame(200, $this->api('user/delUser', ['id' => $this->owned->id, 'confirm' => 1], 'POST')[0]);
        $this->assertSame('customer.delete', $this->api('activity/fetch')[1]['data'][0]['action']);
        $this->assertSame(0, $this->api('activity/fetch', [], 'GET', $tokenB)[1]['data'][0]['target_id'] === $this->owned->id ? 1 : 0);
        $this->assertSame(422, $this->api('activity/fetch', ['pageSize' => 101])[0]);
        $this->assertSame(1, count($this->ctvApi('activity', ['pageSize' => 1])[1]['data']));
    }

    public function test_activity_covers_creation_settings_plans_and_rolls_back_with_data(): void
    {
        [$status, $created] = $this->api('user/create', ['email' => 'journal-new@example.com', 'password' => 'private-pass'], 'POST');
        $this->assertSame(200, $status);
        $this->assertSame('customer.create', $this->api('activity/fetch')[1]['data'][0]['action']);
        $this->assertSame(422, $this->api('user/create', ['email' => 'overflow@example.com', 'password' => 'private-pass'], 'POST')[0]);
        $this->assertSame(1, $this->api('activity/fetch')[1]['total']);
        $this->assertSame(200, $this->api('personalization/update', ['app_name' => 'My Staff'], 'POST')[0]);
        $this->assertSame('staff.personalize', $this->api('activity/fetch')[1]['data'][0]['action']);
        $this->assertSame(200, $this->ctvApi('update', ['id' => $this->a->id, 'staff_customer_limit' => 3,
            'staff_app_name' => 'Admin Name', 'banned' => 0], 'POST')[0]);
        $row = $this->api('activity/fetch')[1]['data'][0];
        $this->assertSame('admin', $row['actor_type']); $this->assertSame($this->admin->id, $row['actor_id']);
        $this->assertSame(['before' => 'My Staff', 'after' => 'Admin Name'], $row['changes']['staff_app_name']);
        $count = \App\Models\StaffActivityLog::count();
        DB::statement("CREATE TRIGGER reject_journal BEFORE INSERT ON v2_staff_activity_log BEGIN SELECT RAISE(ABORT, 'journal unavailable'); END");
        try {
            (new StaffCustomerService())->create($this->a->id, ['email' => 'rollback-journal@example.com', 'password' => 'private-pass']);
            $this->fail('The data change must fail together with its journal entry.');
        } catch (\Illuminate\Database\QueryException $e) {
            $this->assertFalse(User::where('email', 'rollback-journal@example.com')->exists());
            $this->assertSame($count, \App\Models\StaffActivityLog::count());
        }
        DB::statement('DROP TRIGGER reject_journal');
    }

    public function test_catalog_and_grant_activity_are_visible_only_in_their_scope(): void
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $params = ['name' => 'CTV 50 GB', 'group_id' => '1', 'transfer_enable' => '53687091200', 'speed_limit' => '50', 'device_limit' => '2', 'enabled' => '1'];
        [$status, $body] = $this->api('/api/v1/staff-test-admin/staff-plan/save', $params, 'POST', $token);
        $this->assertSame(200, $status); $id = $body['data']['id'];
        $this->assertSame('plan.create', $this->ctvApi('activity')[1]['data'][0]['action']);
        $this->assertSame(0, $this->api('activity/fetch')[1]['total']);
        $this->assertSame(200, $this->api('/api/v1/staff-test-admin/staff-plan/save', $params + ['id' => $id], 'POST', $token)[0]);
        $this->assertSame(1, $this->ctvApi('activity')[1]['total']);
        $grant = ['staff_id' => $this->a->id, 'plan_ids' => [$id]];
        $this->assertSame(200, $this->api('/api/v1/staff-test-admin/staff-plan/assign', $grant, 'POST', $token)[0]);
        $row = $this->api('activity/fetch')[1]['data'][0];
        $this->assertSame('staff.plans', $row['action']);
        $this->assertSame(['before' => [], 'after' => [$id]], $row['changes']['allowed_plan_ids']);
        $this->assertSame(200, $this->api('/api/v1/staff-test-admin/staff-plan/assign', $grant, 'POST', $token)[0]);
        $this->assertSame(2, $this->ctvApi('activity')[1]['total']);
        $tokenB = (new AuthService($this->b))->generateAuthData(Request::create('/'))['auth_data'];
        $this->assertSame(0, $this->api('activity/fetch', [], 'GET', $tokenB)[1]['total']);
    }

    public function test_admin_customer_actions_keep_the_activity_journal_atomic(): void
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $filter = ['filter' => [['key' => 'id', 'condition' => '=', 'value' => $this->owned->id]]];
        DB::statement("CREATE TRIGGER reject_journal BEFORE INSERT ON v2_staff_activity_log BEGIN SELECT RAISE(ABORT, 'journal unavailable'); END");
        $this->assertSame(500, $this->api('/api/v1/staff-test-admin/user/ban', $filter, 'POST', $token)[0]);
        $this->assertSame(0, $this->owned->fresh()->banned);
        $this->assertSame(0, \App\Models\StaffActivityLog::count());
        DB::statement('DROP TRIGGER reject_journal');
        $this->assertSame(200, $this->api('/api/v1/staff-test-admin/user/resetSecret', ['id' => $this->owned->id], 'POST', $token)[0]);
        $this->assertSame(200, $this->api('/api/v1/staff-test-admin/user/ban', $filter, 'POST', $token)[0]);
        $this->assertSame(200, $this->api('/api/v1/staff-test-admin/user/allDel', $filter, 'POST', $token)[0]);
        $logs = $this->api('activity/fetch')[1]['data'];
        $this->assertSame(['customer.delete', 'customer.update', 'customer.reset'], array_column($logs, 'action'));
        $this->assertSame(['admin', 'admin', 'admin'], array_column($logs, 'actor_type'));
    }

    public function test_staff_personalization_is_private_and_independent_of_global_name(): void
    {
        $this->app['config']->set('v2board.app_name', 'Original Panel');
        [$status, $body] = $this->api('personalization/fetch');
        $this->assertSame(200, $status);
        $this->assertSame(User::staffCode($this->a->id), $body['data']['app_name']);
        [$status, $body] = $this->api('personalization/update', ['app_name' => '  Mạng riêng Việt Nam 🌟  '], 'POST');
        $this->assertSame(200, $status);
        $this->assertSame('Mạng riêng Việt Nam 🌟', $body['data']['app_name']);
        $this->assertSame('Mạng riêng Việt Nam 🌟', $this->a->fresh()->staff_app_name);
        $this->assertNull($this->b->fresh()->staff_app_name);
        $this->assertSame('Original Panel', config('v2board.app_name'));
        $this->app['config']->set('v2board.app_name', 'Changed Panel');
        [$status, $body] = $this->api('personalization/fetch');
        $this->assertSame('Mạng riêng Việt Nam 🌟', $body['data']['app_name']);
        $this->assertSame('Mạng riêng Việt Nam 🌟', \App\Services\SubscriptionNameService::forUser($this->owned));
        $this->assertSame(User::staffCode($this->b->id), \App\Services\SubscriptionNameService::forUser($this->other));
        $this->assertSame('Changed Panel', \App\Services\SubscriptionNameService::forUser($this->admin));
        $this->assertSame('Changed Panel', \App\Services\SubscriptionNameService::forUser(User::where('email', 'unassigned@example.com')->first()));
    }

    public function test_personalization_rejects_invalid_names_and_cross_account_targets(): void
    {
        $this->a->update(['staff_app_name' => 'My Staff']);
        foreach (['', '   ', str_repeat('x', 65), "Injected\r\nHeader: value", "Name\x00", "Name\u{2028}Next", ['array']] as $name) {
            [$status] = $this->api('personalization/update', ['app_name' => $name], 'POST');
            $this->assertSame(422, $status);
        }
        foreach (['id' => $this->b->id, 'staff_owner_id' => $this->b->id, 'is_admin' => 1, 'staff_customer_limit' => 999, 'app_url' => 'https://other.example'] as $key => $value) {
            [$status] = $this->api('personalization/update', ['app_name' => 'Other', $key => $value], 'POST');
            $this->assertSame(422, $status);
        }
        $this->assertSame('My Staff', $this->a->fresh()->staff_app_name);
        $this->assertNull($this->b->fresh()->staff_app_name);
        $customerToken = (new AuthService($this->owned))->generateAuthData(Request::create('/'))['auth_data'];
        [$status] = $this->api('personalization/update', ['app_name' => 'Customer'], 'POST', $customerToken);
        $this->assertSame(403, $status);
        $this->a->update(['is_staff' => 0]);
        [$status] = $this->api('personalization/update', ['app_name' => 'Revoked'], 'POST');
        $this->assertSame(403, $status);
    }

    public function test_subscription_headers_use_latest_owner_name_without_cross_request_leaks(): void
    {
        $this->app['config']->set('v2board.app_name', 'Original');
        $this->a->update(['staff_app_name' => 'Mạng A "Riêng"']);
        $this->b->update(['staff_app_name' => 'Mạng B']);
        foreach ([\App\Protocols\Hiddify::class, \App\Protocols\Singbox\Singbox::class, \App\Protocols\Singbox\SingboxOld::class, \App\Protocols\General::class, \App\Protocols\v2RayTun::class, \App\Protocols\V2BOX::class] as $renderer) {
            $response = (new $renderer($this->owned, []))->handle();
            $title = $response->headers->get('profile-title');
            if (strpos($title, 'base64:') === 0) $title = base64_decode(substr($title, 7));
            $this->assertSame('Mạng A "Riêng"', $title, $renderer);
            $this->assertStringNotContainsString('filename="Mạng A "Riêng""', $response->headers->get('content-disposition'));
        }
        $this->a->update(['staff_app_name' => 'Tên mới']);
        $response = (new \App\Protocols\Hiddify($this->owned, []))->handle();
        $this->assertSame('Tên mới', base64_decode(substr($response->headers->get('profile-title'), 7)));
        $response = (new \App\Protocols\Hiddify($this->other, []))->handle();
        $this->assertSame('Mạng B', base64_decode(substr($response->headers->get('profile-title'), 7)));
        $this->assertSame('Original', config('v2board.app_name'));
        $this->owned->update(['staff_owner_id' => $this->b->id]);
        $this->assertSame('Mạng B', \App\Services\SubscriptionNameService::forUser($this->owned));
    }

    public function test_personalized_clash_name_is_replaced_before_yaml_serialization(): void
    {
        $name = 'Tên "riêng": # cá nhân';
        $template = ['proxy-groups' => [['name' => '$app_name', 'type' => 'select', 'proxies' => ['DIRECT']]], 'rules' => ['MATCH,$app_name']];
        $config = \App\Services\SubscriptionNameService::replacePlaceholders($template, $name);
        $parsed = \Symfony\Component\Yaml\Yaml::parse(\Symfony\Component\Yaml\Yaml::dump($config, 2, 4));
        $this->assertSame($name, $parsed['proxy-groups'][0]['name']);
        $this->assertSame('MATCH,' . $name, $parsed['rules'][0]);
    }

    public function test_staff_lists_only_own_customers_and_hides_passwords(): void
    {
        [$status, $body] = $this->api('user/fetch');
        $this->assertSame(200, $status);
        $this->assertSame(1, $body['total']);
        $this->assertSame($this->owned->id, $body['data'][0]['id']);
        $this->assertArrayNotHasKey('password', $body['data'][0]);
        $this->assertArrayNotHasKey('token', $body['data'][0]);
        $this->assertArrayNotHasKey('uuid', $body['data'][0]);
        $this->assertArrayNotHasKey('subscribe_url', $body['data'][0]);
        [$status, $body] = $this->api('user/fetch', ['search' => 'b-customer']);
        $this->assertSame(0, $body['total']);
    }

    public function test_customer_menu_actions_reject_every_out_of_scope_account(): void
    {
        $assigned = User::create(['email' => 'only-assigned@example.com', 'staff_owner_id' => $this->a->id]);
        $transferred = User::create(['email' => 'transferred@example.com', 'staff_owner_id' => $this->b->id, 'staff_creator_id' => $this->a->id]);
        $unassigned = User::where('email', 'unassigned@example.com')->first();
        foreach ([$this->other, $this->admin, $this->a, $this->b, $assigned, $transferred, $unassigned] as $user) {
            foreach (['getSubscription' => 'GET', 'getTrafficLog' => 'GET', 'resetSecret' => 'POST', 'delUser' => 'POST'] as $action => $method) {
                $this->assertSame(404, $this->api('user/' . $action, ['id' => $user->id, 'confirm' => 1], $method)[0], $action);
            }
            $this->assertNotNull($user->fresh());
        }
    }

    public function test_customer_subscription_is_fetched_separately_without_raw_credentials(): void
    {
        $this->owned->update(['token' => 'own-subscription-token', 'uuid' => 'own-node-secret']);
        $this->app['config']->set('v2board.subscribe_url', 'https://example.test');
        [$status, $body] = $this->api('user/getSubscription', ['id' => $this->owned->id]);
        $this->assertSame(200, $status);
        $this->assertSame(['subscribe_url'], array_keys($body['data']));
        $this->assertSame('https://example.test/api/v1/client/subscribe?token=own-subscription-token', $body['data']['subscribe_url']);
        $this->assertStringNotContainsString('own-node-secret', json_encode($body));
        [$status] = $this->api('user/getSubscription', ['id' => 0]);
        $this->assertSame(422, $status);
    }

    public function test_reset_secret_requires_confirmation_rotates_only_own_customer_and_revokes_old_otp(): void
    {
        $this->owned->update(['token' => 'original', 'uuid' => 'original-uuid']);
        $this->other->update(['token' => 'other-token', 'uuid' => 'other-uuid']);
        Cache::put('otp_original', 'old-otp'); Cache::put('otpn_old-otp', 'original');
        $this->assertSame(422, $this->api('user/resetSecret', ['id' => $this->owned->id], 'POST')[0]);
        $this->assertSame('original', $this->owned->fresh()->token);
        [$status, $body] = $this->api('user/resetSecret', ['id' => $this->owned->id, 'confirm' => 1], 'POST');
        $this->assertSame(200, $status); $this->assertTrue($body['data']);
        $this->assertNotSame('original', $this->owned->fresh()->token);
        $this->assertNotSame('original-uuid', $this->owned->fresh()->uuid);
        $this->assertFalse(User::where('token', 'original')->exists());
        $this->assertFalse(Cache::has('otp_original')); $this->assertFalse(Cache::has('otpn_old-otp'));
        $this->assertSame('other-token', $this->other->fresh()->token);
        $this->assertSame('other-uuid', $this->other->fresh()->uuid);
    }

    public function test_traffic_history_paginates_only_the_selected_customer_records(): void
    {
        DB::table('v2_stat_user')->insert([
            ['user_id' => $this->owned->id, 'u' => 11, 'd' => 22, 'record_at' => 100, 'server_rate' => 1],
            ['user_id' => $this->owned->id, 'u' => 33, 'd' => 44, 'record_at' => 200, 'server_rate' => 2],
            ['user_id' => $this->other->id, 'u' => 999, 'd' => 999, 'record_at' => 300, 'server_rate' => 3],
        ]);
        [$status, $body] = $this->api('user/getTrafficLog', ['id' => $this->owned->id, 'pageSize' => 1]);
        $this->assertSame(200, $status); $this->assertSame(2, $body['total']);
        $this->assertSame(33, $body['data'][0]['u']); $this->assertCount(1, $body['data']);
        [, $body] = $this->api('user/getTrafficLog', ['id' => $this->owned->id, 'pageSize' => 1, 'current' => 2]);
        $this->assertSame(11, $body['data'][0]['u']);
        $this->assertSame(422, $this->api('user/getTrafficLog', ['id' => $this->owned->id, 'current' => 0])[0]);
    }

    public function test_customer_deletion_requires_confirmation_cleans_own_data_and_frees_quota(): void
    {
        $this->a->update(['staff_customer_limit' => 1]);
        $customerSession = (new AuthService($this->owned))->generateAuthData(Request::create('/'))['auth_data'];
        Cache::put($customerSession, ['id' => $this->owned->id]);
        foreach (['v2_order', 'v2_invite_code'] as $table) DB::table($table)->insert([['user_id' => $this->owned->id], ['user_id' => $this->other->id]]);
        $ticket = Ticket::create(['user_id' => $this->owned->id, 'subject' => 'Own']);
        $otherTicket = Ticket::create(['user_id' => $this->other->id, 'subject' => 'Other']);
        DB::table('v2_ticket_message')->insert(['ticket_id' => $ticket->id, 'user_id' => $this->admin->id, 'message' => 'Reply']);
        DB::table('v2_stat_user')->insert(['user_id' => $this->owned->id, 'record_at' => 100]);
        $this->assertSame(422, $this->api('user/delUser', ['id' => $this->owned->id], 'POST')[0]);
        $this->assertNotNull($this->owned->fresh());
        $this->assertSame(200, $this->api('user/delUser', ['id' => $this->owned->id, 'confirm' => 1], 'POST')[0]);
        $this->assertNull($this->owned->fresh()); $this->assertNotNull($this->other->fresh());
        foreach (['v2_order', 'v2_invite_code'] as $table) {
            $this->assertSame(0, DB::table($table)->where('user_id', $this->owned->id)->count());
            $this->assertSame(1, DB::table($table)->where('user_id', $this->other->id)->count());
        }
        $this->assertNull($ticket->fresh()); $this->assertNotNull($otherTicket->fresh());
        $this->assertSame(0, DB::table('v2_ticket_message')->count());
        $this->assertSame(0, DB::table('v2_stat_user')->count());
        $this->assertFalse(Cache::has($customerSession));
        [, $body] = $this->api('user/summary'); $this->assertSame(1, $body['data']['remaining']);
        $created = (new StaffCustomerService())->create($this->a->id, ['email' => 'replacement@example.com', 'password' => 'password123']);
        $this->assertSame($this->a->id, $created->staff_owner_id);
    }

    public function test_customer_deletion_never_clears_other_staff_invite_references(): void
    {
        $this->other->update(['invite_user_id' => $this->owned->id]);
        $this->assertSame(422, $this->api('user/delUser', ['id' => $this->owned->id, 'confirm' => 1], 'POST')[0]);
        $this->assertNotNull($this->owned->fresh());
        $this->assertSame($this->owned->id, $this->other->fresh()->invite_user_id);
    }

    public function test_staff_cannot_read_or_update_other_staff_admin_or_unassigned_users(): void
    {
        foreach ([$this->other, $this->b, $this->admin, User::whereNull('staff_owner_id')->where('is_staff', 0)->where('is_admin', 0)->first()] as $user) {
            $this->assertSame(404, $this->api('user/getUserInfoById', ['id' => $user->id])[0]);
            $this->assertSame(404, $this->api('user/update', ['id' => $user->id, 'email' => $user->email, 'banned' => 0], 'POST')[0]);
            $this->assertSame(404, $this->api('user/ban', ['id' => $user->id], 'POST')[0]);
            $this->assertSame(404, $this->api('user/sendMail', ['id' => $user->id, 'subject' => 'Hello', 'content' => 'Hello'], 'POST')[0]);
        }
        $this->assertSame(0, (int) $this->other->fresh()->banned);
    }

    public function test_staff_updates_own_customer_without_changing_ownership(): void
    {
        $status = $this->api('user/update', ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0, 'remarks' => 'Own note'], 'POST')[0];
        $this->assertSame(200, $status);
        $this->assertSame('Own note', $this->owned->fresh()->remarks);
        foreach (['staff_owner_id' => $this->b->id, 'staff_creator_id' => $this->b->id, 'is_staff' => 1, 'is_admin' => 1, 'staff_customer_limit' => 99] as $key => $value) {
            $this->assertSame(422, $this->api('user/update', ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0, $key => $value], 'POST')[0]);
            $this->assertSame(422, $this->api('user/update', ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0, $key => null], 'POST')[0]);
        }
        $this->assertSame($this->a->id, $this->owned->fresh()->staff_owner_id);
    }

    public function test_creating_customers_assigns_owner_and_enforces_quota(): void
    {
        $payload = ['email' => 'new@example.com', 'password' => 'password123'];
        [$status, $body] = $this->api('user/create', $payload, 'POST');
        $this->assertSame(200, $status);
        $this->assertSame($this->a->id, $body['data']['staff_owner_id']);
        $this->assertSame($this->a->id, $body['data']['staff_creator_id']);
        $created = User::find($body['data']['id']);
        $this->assertSame(200, $this->api('user/update', ['id' => $created->id, 'email' => $created->email, 'banned' => 0, 'remarks' => 'Created by me'], 'POST')[0]);
        $this->assertStringStartsWith($this->a->staff_code . '-KH-', $body['data']['customer_code']);
        $this->assertArrayNotHasKey('password', $body['data']);
        $payload['email'] = 'overflow@example.com';
        $this->assertSame(422, $this->api('user/create', $payload, 'POST')[0]);
        $this->assertFalse(User::where('email', 'overflow@example.com')->exists());
        $summary = $this->api('user/summary')[1]['data'];
        $this->assertSame(2, $summary['customer_count']);
        $this->assertSame(0, $summary['remaining']);
    }

    public function test_staff_editor_saves_traffic_speed_and_preserves_admin_only_settings(): void
    {
        $this->owned->update(['plan_id' => 77, 'group_id' => 88, 'device_limit' => 3,
            'balance' => 500, 'commission_balance' => 200, 'commission_rate' => 10, 'discount' => 15]);
        $payload = ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0,
            'u' => 1073741824, 'd' => 2147483648, 'transfer_enable' => 10737418240,
            'speed_limit' => 50, 'expired_at' => 1800000000, 'remarks' => 'Updated traffic'];
        $this->assertSame(200, $this->api('user/update', $payload, 'POST')[0]);
        $user = $this->owned->fresh();
        foreach (['u', 'd', 'transfer_enable', 'speed_limit', 'expired_at'] as $key) $this->assertSame($payload[$key], (int) $user->$key);
        foreach (['plan_id' => 77, 'group_id' => 88, 'device_limit' => 3, 'balance' => 500,
            'commission_balance' => 200, 'commission_rate' => 10, 'discount' => 15] as $key => $value) {
            $this->assertSame($value, (int) $user->$key);
        }
        $this->assertSame(200, $this->api('user/update', ['id' => $user->id, 'email' => $user->email, 'banned' => 0, 'speed_limit' => null], 'POST')[0]);
        $this->assertNull($user->fresh()->speed_limit);
        $this->assertSame(1073741824, (int) $user->fresh()->u);
        $this->assertSame(0, (int) $this->other->fresh()->u);
    }

    public function test_removed_editor_fields_are_rejected_even_when_null_and_never_exposed(): void
    {
        $forbidden = ['balance', 'commission_balance', 'device_limit', 'plan_id', 'group_id',
            'commission_type', 'commission_rate', 'discount', 'is_admin', 'is_staff',
            'staff_owner_id', 'staff_creator_id', 'staff_customer_limit', 'invite_user_email', 'invite_user_id', 'token', 'uuid'];
        foreach ($forbidden as $key) {
            foreach ([1, null] as $value) {
                $this->assertSame(422, $this->api('user/update', ['id' => $this->owned->id,
                    'email' => $this->owned->email, 'banned' => 0, $key => $value], 'POST')[0], $key);
                $this->assertSame(422, $this->api('user/create', ['email' => 'new@example.com',
                    'password' => 'password123', $key => $value], 'POST')[0], $key);
            }
        }
        $data = $this->api('user/getUserInfoById', ['id' => $this->owned->id])[1]['data'];
        foreach (['balance', 'commission_balance', 'device_limit', 'commission_type', 'commission_rate', 'discount', 'invite_user_email', 'invite_user_id'] as $key) {
            $this->assertArrayNotHasKey($key, $data);
        }
        $this->assertSame(1, User::where('staff_owner_id', $this->a->id)->count());
    }

    public function test_staff_editor_rejects_invalid_traffic_and_speed(): void
    {
        $base = ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0];
        foreach (['u', 'd', 'transfer_enable'] as $key) {
            foreach ([-1, 1.5, null, 'NaN', '9007199254740992'] as $value) {
                $this->assertSame(422, $this->api('user/update', $base + [$key => $value], 'POST')[0]);
            }
        }
        foreach ([-1, 1.5, 'bad', 2147483648] as $value) {
            $this->assertSame(422, $this->api('user/update', $base + ['speed_limit' => $value], 'POST')[0]);
        }
    }

    public function test_removed_inviter_email_is_not_exposed_and_existing_referrals_are_preserved(): void
    {
        $this->owned->update(['invite_user_id' => $this->other->id]);
        $data = $this->api('user/getUserInfoById', ['id' => $this->owned->id])[1]['data'];
        $this->assertArrayNotHasKey('invite_user_email', $data);
        $this->assertArrayNotHasKey('invite_user_id', $data);
        $base = ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0];
        $this->assertSame(200, $this->api('user/update', $base + ['remarks' => 'Preserve referral'], 'POST')[0]);
        $this->assertSame($this->other->id, $this->owned->fresh()->invite_user_id);
        foreach ([$this->other, $this->admin, $this->owned, $this->a] as $inviter) {
            $this->assertSame(422, $this->api('user/update', $base + ['invite_user_email' => $inviter->email], 'POST')[0]);
        }
        $new = ['email' => 'new@example.com', 'password' => 'password123',
            'transfer_enable' => 53687091200, 'u' => 0, 'd' => 0, 'speed_limit' => 100];
        $this->assertSame(422, $this->api('user/create', array_replace($new, ['invite_user_email' => $this->other->email]), 'POST')[0]);
        [$status, $body] = $this->api('user/create', $new, 'POST');
        $this->assertSame(200, $status);
        $created = User::find($body['data']['id']);
        $this->assertNull($created->invite_user_id);
        $this->assertArrayNotHasKey('invite_user_email', $body['data']);
        $this->assertSame(53687091200, (int) $created->transfer_enable);
        $this->assertSame(100, (int) $created->speed_limit);
        $this->assertNull($created->plan_id);
        $this->assertSame(422, $this->api('user/update', $base + ['invite_user_email' => $created->email], 'POST')[0]);
        $this->assertSame(422, $this->api('user/update', $base + ['invite_user_email' => null], 'POST')[0]);
        $this->assertSame($this->other->id, $this->owned->fresh()->invite_user_id);
    }

    public function test_blocked_or_expired_customers_still_count_and_zero_disables_creation(): void
    {
        $this->owned->update(['banned' => 1, 'expired_at' => 1]);
        $this->a->update(['staff_customer_limit' => 1]);
        $payload = ['email' => 'overflow@example.com', 'password' => 'password123'];
        $this->assertSame(422, $this->api('user/create', $payload, 'POST')[0]);
        $this->owned->delete(); $this->a->update(['staff_customer_limit' => 0]);
        $this->assertSame(422, $this->api('user/create', $payload, 'POST')[0]);
    }

    public function test_create_cannot_spoof_ownership_or_roles_and_failure_rolls_back(): void
    {
        $payload = ['email' => 'new@example.com', 'password' => 'password123'];
        $this->assertSame(422, $this->api('user/create', $payload + ['staff_owner_id' => $this->b->id], 'POST')[0]);
        $this->assertSame(422, $this->api('user/create', $payload + ['staff_owner_id' => null], 'POST')[0]);
        $this->assertSame(422, $this->api('user/create', $payload + ['is_admin' => 1], 'POST')[0]);
        $this->assertSame(422, $this->api('user/create', $payload + ['plan_id' => 999], 'POST')[0]);
        $this->assertSame(1, User::where('staff_owner_id', $this->a->id)->count());
    }

    public function test_admin_transfer_checks_capacity_and_rebuilds_customer_code(): void
    {
        $service = new StaffCustomerService();
        try {
            $service->updateByAdmin($this->owned, ['staff_owner_id' => $this->b->id]);
            $this->fail('Transferred into a full Staff quota.');
        } catch (HttpException $e) { $this->assertSame(422, $e->getStatusCode()); }
        $this->assertSame($this->a->id, $this->owned->fresh()->staff_owner_id);
        $service->updateByAdmin($this->b, ['staff_customer_limit' => 2]);
        $service->updateByAdmin($this->owned, ['staff_owner_id' => $this->b->id]);
        $this->assertStringStartsWith($this->b->staff_code, $this->owned->fresh()->customer_code);
        $this->assertSame(404, $this->api('user/getUserInfoById', ['id' => $this->owned->id])[0]);
    }

    public function test_admin_cannot_lower_quota_below_usage_or_turn_owned_customer_into_staff(): void
    {
        $service = new StaffCustomerService();
        foreach ([[$this->a, ['staff_customer_limit' => 0]], [$this->owned, ['is_staff' => 1]], [$this->a, ['is_staff' => 0]]] as $case) {
            try { $service->updateByAdmin($case[0], $case[1]); $this->fail('Invalid Admin change accepted.'); }
            catch (HttpException $e) { $this->assertSame(422, $e->getStatusCode()); }
        }
    }

    public function test_removed_staff_routes_are_unavailable_even_for_own_customers(): void
    {
        foreach ([
            'ticket/fetch' => 'GET', 'ticket/reply' => 'POST', 'ticket/close' => 'POST',
            'notice/fetch' => 'GET', 'notice/save' => 'POST', 'notice/update' => 'POST',
            'user/getInvites' => 'GET', 'notice/drop' => 'POST', 'notice/show' => 'POST', 'plan/assign' => 'POST',
            'user/sendMail' => 'POST', 'user/ban' => 'POST', 'order/fetch' => 'GET', 'order/assign' => 'POST',
            'user/generate' => 'POST', 'user/dumpCSV' => 'POST', 'plan/save' => 'POST',
            'plan/update' => 'POST', 'plan/drop' => 'POST', 'plan/sort' => 'POST'
        ] as $path => $method) {
            $this->assertSame(404, $this->api($path, ['id' => $this->owned->id, 'message' => 'Denied'], $method)[0], $path);
        }
    }

    public function test_staff_cannot_reply_to_tickets_through_shared_service(): void
    {
        $ticket = Ticket::create(['user_id' => $this->owned->id, 'subject' => 'Own']);
        try {
            (new \App\Services\TicketService())->replyByAdmin($ticket->id, 'Denied', $this->a->id);
            $this->fail('Staff replied through shared Telegram/Admin service.');
        } catch (HttpException $e) { $this->assertSame(403, $e->getStatusCode()); }
        $this->assertSame(0, DB::table('v2_ticket_message')->count());
    }

    public function test_customer_sees_global_notices_and_only_their_staff_notices(): void
    {
        Notice::create(['title' => 'Global', 'content' => 'Global', 'show' => 1]);
        Notice::create(['staff_owner_id' => $this->a->id, 'title' => 'Own', 'content' => 'Own', 'show' => 1]);
        $other = Notice::create(['staff_owner_id' => $this->b->id, 'title' => 'Other', 'content' => 'Other', 'show' => 1]);
        $controller = new \App\Http\Controllers\V1\User\NoticeController();
        $request = Request::create('/'); $request->merge(['user' => ['id' => $this->owned->id]]);
        $body = json_decode($controller->fetch($request)->getContent(), true);
        $this->assertSame(2, $body['total']);
        $request->merge(['id' => $other->id]);
        $this->assertSame(404, $controller->fetch($request)->getStatusCode());
    }

    public function test_admin_assignment_alone_does_not_grant_staff_edit_access(): void
    {
        $assigned = User::create(['email' => 'assigned@example.com', 'staff_owner_id' => $this->a->id]);
        $this->assertSame(404, $this->api('user/getUserInfoById', ['id' => $assigned->id])[0]);
        $this->assertSame(404, $this->api('user/update', ['id' => $assigned->id, 'email' => $assigned->email, 'banned' => 0], 'POST')[0]);
        $this->assertSame(1, $this->api('user/fetch')[1]['total']);
        $this->assertSame(2, $this->api('user/summary')[1]['data']['customer_count']);
        (new StaffCustomerService())->updateByAdmin($assigned, ['staff_creator_id' => $this->a->id]);
        $this->assertSame(200, $this->api('user/getUserInfoById', ['id' => $assigned->id])[0]);
        $this->assertSame(2, $this->api('user/fetch')[1]['total']);
    }

    public function test_revocation_and_ban_take_effect_with_cached_auth(): void
    {
        $this->assertSame(200, $this->api('user/summary')[0]);
        $this->assertTrue(Cache::has($this->token));
        $this->a->update(['is_staff' => 0]);
        $this->assertSame(403, $this->api('user/summary')[0]);
        $this->a->update(['is_staff' => 1, 'banned' => 1]);
        $this->assertSame(403, $this->api('user/summary')[0]);
    }

    public function test_logout_revokes_cached_auth(): void
    {
        $this->assertSame(200, $this->api('user/summary')[0]);
        $this->assertSame(200, $this->api('logout', [], 'POST')[0]);
        $this->assertFalse(AuthService::decryptAuthData($this->token));
        $this->assertSame(403, $this->api('user/summary')[0]);
    }

    public function test_telegram_notifications_no_longer_go_to_staff(): void
    {
        $recipients = [];
        $this->app->instance(\Illuminate\Contracts\Bus\Dispatcher::class, new class($recipients) {
            private $recipients;
            public function __construct(&$recipients) { $this->recipients =& $recipients; }
            public function dispatch($job) { $this->recipients[] = $job; }
        });
        (new TelegramService())->sendMessageWithAdmin('Private ticket', true, $this->owned->id);
        $this->assertCount(1, $recipients);
        $property = new \ReflectionProperty(\App\Jobs\SendTelegramJob::class, 'telegramId');
        $ids = array_map(function ($job) use ($property) { return $property->getValue($job); }, $recipients);
        sort($ids);
        $this->assertSame([103], $ids);
    }

    public function test_admin_can_save_existing_customer_of_banned_staff_but_cannot_assign_more(): void
    {
        $this->a->update(['banned' => 1]);
        $service = new StaffCustomerService();
        $service->updateByAdmin($this->owned, ['email' => 'updated@example.com', 'staff_owner_id' => $this->a->id]);
        $this->assertSame('updated@example.com', $this->owned->fresh()->email);
        try {
            $service->updateByAdmin($this->other, ['staff_owner_id' => $this->a->id]);
            $this->fail('Assigned a new customer to banned Staff.');
        } catch (HttpException $e) { $this->assertSame(422, $e->getStatusCode()); }
    }

    public function test_migration_adds_fields_without_changing_legacy_users_and_is_repeatable(): void
    {
        $schema = DB::connection()->getSchemaBuilder();
        $schema->drop('v2_user'); $schema->drop('v2_notice');
        $schema->create('v2_user', function (Blueprint $table) { $table->increments('id'); $table->string('email'); });
        $schema->create('v2_notice', function (Blueprint $table) { $table->increments('id'); });
        DB::table('v2_user')->insert(['email' => 'legacy@example.com']);
        require_once dirname(__DIR__, 2) . '/database/migrations/2026_10_07_000000_add_staff_ownership.php';
        $migration = new \AddStaffOwnership(); $migration->up(); $migration->up();
        $this->assertTrue($schema->hasColumn('v2_notice', 'staff_owner_id'));
        $this->assertTrue($schema->hasColumn('v2_user', 'staff_customer_limit'));
        $row = DB::table('v2_user')->first();
        $this->assertSame('legacy@example.com', $row->email);
        $this->assertNull($row->staff_owner_id);
        $this->assertSame(0, $row->staff_customer_limit);
        DB::table('v2_user')->update(['staff_owner_id' => 12]);
        require_once dirname(__DIR__, 2) . '/database/migrations/2026_10_07_000001_add_staff_customer_creator.php';
        $creatorMigration = new \AddStaffCustomerCreator(); $creatorMigration->up(); $creatorMigration->up();
        $this->assertNull(DB::table('v2_user')->value('staff_creator_id'));
        require_once dirname(__DIR__, 2) . '/database/migrations/2026_10_07_000002_add_staff_app_name.php';
        $nameMigration = new \AddStaffAppName(); $nameMigration->up(); $nameMigration->up();
        $this->assertNull(DB::table('v2_user')->value('staff_app_name'));
        $planMigration = new \AddStaffPlans(); $planMigration->up(); $planMigration->up();
        $this->assertNull(DB::table('v2_user')->value('staff_plan_id'));
        $this->assertTrue($schema->hasTable('v2_staff_plan_permission'));
    }

    public function test_admin_endpoint_sets_quota_and_rejects_staff_access(): void
    {
        $payload = ['id' => $this->a->id, 'banned' => 0, 'staff_customer_limit' => 5, 'staff_app_name' => null];
        $path = '/api/v1/staff-test-admin/ctv/update';
        $this->assertSame(403, $this->api($path, $payload, 'POST')[0]);
        $adminToken = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $this->assertSame(200, $this->api($path, $payload, 'POST', $adminToken)[0]);
        $this->assertSame(5, $this->a->fresh()->staff_customer_limit);
        $payload['staff_customer_limit'] = -1;
        $this->assertSame(422, $this->api($path, $payload, 'POST', $adminToken)[0]);
    }

    public function test_admin_cannot_delete_staff_who_still_owns_customers(): void
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        foreach (['delUser' => ['id' => $this->a->id], 'allDel' => ['filter' => [['key' => 'id', 'condition' => '=', 'value' => $this->a->id]]]] as $action => $data) {
            $this->assertSame(422, $this->api('/api/v1/staff-test-admin/user/' . $action, $data, 'POST', $token)[0]);
        }
        $this->assertNotNull($this->a->fresh());
        $this->assertSame($this->a->id, $this->owned->fresh()->staff_owner_id);
        $this->assertSame(0, DB::transactionLevel());
    }
    public function test_transfer_does_not_change_creator_or_grant_recipient_access(): void
    {
        $this->b->update(['staff_customer_limit' => 2]);
        (new StaffCustomerService())->updateByAdmin($this->owned, ['staff_owner_id' => $this->b->id]);
        $this->assertSame($this->a->id, $this->owned->fresh()->staff_creator_id);
        $tokenB = (new AuthService($this->b))->generateAuthData(Request::create('/'))['auth_data'];
        foreach ([$this->token, $tokenB] as $token) {
            $this->assertSame(404, $this->api('user/getUserInfoById', ['id' => $this->owned->id], 'GET', $token)[0]);
            $this->assertSame(404, $this->api('user/update', ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0], 'POST', $token)[0]);
        }
    }

    public function test_creation_history_is_immutable_even_through_admin_api(): void
    {
        foreach ([$this->b->id, null] as $creatorId) {
            try {
                (new StaffCustomerService())->updateByAdmin($this->owned, ['staff_creator_id' => $creatorId]);
                $this->fail('Changed immutable creation history.');
            } catch (HttpException $e) { $this->assertSame(422, $e->getStatusCode()); }
        }
        $this->assertSame($this->a->id, $this->owned->fresh()->staff_creator_id);
    }

    public function test_old_queued_staff_notification_is_skipped_without_contacting_telegram(): void
    {
        // This would attempt a Telegram request if the old Staff recipient were still allowed.
        (new \App\Jobs\SendTelegramJob(101, 'Old private ticket'))->handle();
        $this->assertSame(1, User::where('telegram_id', 101)->where('is_admin', 0)->count());
    }

    private function ctvApi($action, array $data = [], $method = 'GET')
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        return $this->api('/api/v1/staff-test-admin/ctv/' . $action, $data, $method, $token);
    }

    public function test_ctv_lists_only_staff_with_safe_quota_and_personalization_data(): void
    {
        $this->a->update(['staff_app_name' => 'Private A']);
        $this->admin->update(['is_staff' => 1]);
        $plan = $this->privatePlan(); $this->grantPlan($plan);
        [$status, $body] = $this->ctvApi('fetch');
        $this->assertSame(200, $status); $this->assertSame(2, $body['total']);
        $row = $body['data'][0];
        $this->assertSame($this->a->id, $row['id']); $this->assertSame(1, $row['customer_count']);
        $this->assertSame(2, $row['staff_customer_limit']); $this->assertSame(1, $row['allowed_plan_count']);
        $this->assertSame('Private A', $row['app_name']);
        foreach (['password', 'token', 'uuid', 'balance', 'commission_balance'] as $key) $this->assertArrayNotHasKey($key, $row);
        [$status, $body] = $this->ctvApi('fetch', ['search' => $this->b->staff_code, 'pageSize' => 1]);
        $this->assertSame(200, $status); $this->assertSame(1, $body['total']); $this->assertSame($this->b->id, $body['data'][0]['id']);
        $this->assertSame(422, $this->ctvApi('fetch', ['pageSize' => 101])[0]);
    }

    public function test_ctv_settings_are_admin_only_and_keep_limits_and_names_scoped(): void
    {
        $payload = ['id' => $this->a->id, 'banned' => 0, 'staff_customer_limit' => 3, 'staff_app_name' => '  Name A  '];
        $this->assertSame(200, $this->ctvApi('update', $payload, 'POST')[0]);
        $this->assertSame('Name A', $this->a->fresh()->staff_app_name);
        $this->assertNull($this->b->fresh()->staff_app_name); $this->assertSame(3, $this->a->fresh()->staff_customer_limit);
        foreach (['staff_customer_limit' => 0, 'staff_app_name' => "Bad\r\nHeader"] as $key => $value) {
            $invalid = $payload; $invalid[$key] = $value;
            $this->assertSame(422, $this->ctvApi('update', $invalid, 'POST')[0]);
        }
        foreach (['is_admin' => 1, 'is_staff' => 0, 'staff_owner_id' => $this->b->id, 'balance' => 999] as $key => $value) {
            $this->assertSame(422, $this->ctvApi('update', $payload + [$key => $value], 'POST')[0]);
        }
        $this->assertSame(403, $this->ctvApi('update', array_replace($payload, ['id' => $this->owned->id]), 'POST')[0]);
        foreach (['fetch' => 'GET', 'customers' => 'GET', 'update' => 'POST', 'assign' => 'POST'] as $action => $method) {
            $this->assertSame(403, $this->api('/api/v1/staff-test-admin/ctv/' . $action, $payload, $method)[0]);
        }
        $payload['staff_app_name'] = null;
        $this->assertSame(200, $this->ctvApi('update', $payload, 'POST')[0]);
        $this->assertNull($this->a->fresh()->staff_app_name);
        $payload['banned'] = 1;
        $this->assertSame(200, $this->ctvApi('update', $payload, 'POST')[0]);
        $this->assertSame(403, $this->api('user/summary')[0]);
    }

    public function test_ctv_customer_assignment_preserves_creation_history_and_checks_quota(): void
    {
        [$status, $body] = $this->ctvApi('customers', ['staff_owner_id' => $this->a->id]);
        $this->assertSame(200, $status); $this->assertSame(1, $body['total']);
        $this->assertSame($this->owned->id, $body['data'][0]['id']);
        $this->assertSame($this->a->staff_code, $body['data'][0]['creator_code']);
        foreach (['password', 'token', 'uuid', 'balance'] as $key) $this->assertArrayNotHasKey($key, $body['data'][0]);
        $move = ['id' => $this->owned->id, 'staff_owner_id' => $this->b->id];
        $this->assertSame(422, $this->ctvApi('assign', $move, 'POST')[0]);
        $this->b->update(['staff_customer_limit' => 2]);
        $this->assertSame(200, $this->ctvApi('assign', $move, 'POST')[0]);
        $this->assertSame($this->b->id, $this->owned->fresh()->staff_owner_id);
        $this->assertSame($this->a->id, $this->owned->fresh()->staff_creator_id);
        $this->assertSame(422, $this->ctvApi('assign', $move + ['staff_creator_id' => $this->b->id], 'POST')[0]);
        $this->assertSame(422, $this->ctvApi('assign', $move + ['is_admin' => 1], 'POST')[0]);
        foreach ([$this->a->id, $this->admin->id] as $id) {
            $this->assertSame(404, $this->ctvApi('assign', ['id' => $id, 'staff_owner_id' => null], 'POST')[0]);
        }
        $this->assertSame(200, $this->ctvApi('assign', ['id' => $this->owned->id, 'staff_owner_id' => null], 'POST')[0]);
        $this->assertNull($this->owned->fresh()->staff_owner_id);
        $legacy = User::where('email', 'unassigned@example.com')->first();
        $this->assertSame(200, $this->ctvApi('assign', ['id' => $legacy->id, 'staff_owner_id' => $this->a->id,
            'staff_creator_id' => $this->a->id], 'POST')[0]);
        $this->assertSame($this->a->id, $legacy->fresh()->staff_creator_id);
        $this->assertSame(1, $this->ctvApi('customers', ['unassigned' => 1])[1]['total']);
    }

    public function test_user_editor_keeps_staff_toggle_and_rejects_moved_settings(): void
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $user = User::where('email', 'unassigned@example.com')->first();
        $payload = ['id' => $user->id, 'email' => $user->email, 'is_admin' => 0, 'is_staff' => 1, 'banned' => 0];
        $path = '/api/v1/staff-test-admin/user/update';
        $this->assertSame(200, $this->api($path, $payload, 'POST', $token)[0]);
        $this->assertSame(1, $user->fresh()->is_staff);
        foreach (['staff_customer_limit' => 5, 'staff_owner_id' => null, 'staff_creator_id' => null, 'staff_app_name' => 'Moved'] as $key => $value) {
            $this->assertSame(422, $this->api($path, $payload + [$key => $value], 'POST', $token)[0]);
        }
        $this->assertSame(0, $user->fresh()->staff_customer_limit);
        $this->assertSame(200, $this->adminPlanApi('fetch', [], 'GET')[0]);
    }

    private function privatePlan($name = 'Staff 100 GB', $groupId = 1, $enabled = true)
    {
        return \App\Models\StaffPlan::create(['name' => $name, 'group_id' => $groupId,
            'transfer_enable' => 100 * 1073741824, 'speed_limit' => 50, 'device_limit' => 2, 'enabled' => $enabled]);
    }

    private function grantPlan($plan, $staff = null)
    {
        DB::table('v2_staff_plan_permission')->insert(['staff_id' => ($staff ?? $this->a)->id, 'staff_plan_id' => $plan->id]);
    }

    private function adminPlanApi($action, array $data, $method = 'POST')
    {
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        return $this->api('/api/v1/staff-test-admin/staff-plan/' . $action, $data, $method, $token);
    }

    public function test_admin_manages_a_separate_shared_catalog_and_per_staff_grants(): void
    {
        DB::table('v2_plan')->insert(['id' => 77, 'name' => 'Main admin plan', 'group_id' => 2]);
        [$status, $body] = $this->adminPlanApi('save', ['name' => 'Private plan', 'group_id' => 1,
            'transfer_enable' => 50 * 1073741824, 'speed_limit' => 30, 'device_limit' => 2, 'enabled' => 1]);
        $this->assertSame(200, $status);
        $id = $body['data']['id'];
        $this->assertSame(1, DB::table('v2_plan')->count());
        $this->assertSame('Main admin plan', DB::table('v2_plan')->value('name'));
        $otherPlan = $this->privatePlan('Other staff plan', 2);
        $disabled = $this->privatePlan('Disabled plan', 1, false);
        $this->assertSame(200, $this->adminPlanApi('assign', ['staff_id' => $this->a->id, 'plan_ids' => [$id, $disabled->id]])[0]);
        $this->assertSame(200, $this->adminPlanApi('assign', ['staff_id' => $this->b->id, 'plan_ids' => [$otherPlan->id]])[0]);
        [$status, $body] = $this->api('plan/fetch');
        $this->assertSame(200, $status);
        $this->assertSame([$id], array_column($body['data'], 'id'));
        $this->assertSame(['id', 'name', 'transfer_enable', 'speed_limit'], array_keys($body['data'][0]));
        $tokenB = (new AuthService($this->b))->generateAuthData(Request::create('/'))['auth_data'];
        $this->assertSame([$otherPlan->id], array_column($this->api('plan/fetch', [], 'GET', $tokenB)[1]['data'], 'id'));
        [$status, $body] = $this->adminPlanApi('fetch', ['staff_id' => $this->b->id], 'GET');
        $this->assertSame(200, $status);
        $this->assertCount(3, $body['data']['plans']);
        $this->assertSame([$otherPlan->id], $body['data']['allowed_plan_ids']);
        $this->assertCount(2, $body['data']['groups']);
        foreach (['save', 'assign', 'fetch'] as $action) {
            $this->assertSame(403, $this->api('/api/v1/staff-test-admin/staff-plan/' . $action,
                ['staff_id' => $this->a->id], $action === 'fetch' ? 'GET' : 'POST')[0]);
        }
    }

    public function test_invalid_admin_grants_roll_back_and_revocation_is_scoped(): void
    {
        $plan = $this->privatePlan(); $this->grantPlan($plan); $this->grantPlan($plan, $this->b);
        foreach ([[$plan->id, 999], [$plan->id, $plan->id], [null], ['bad']] as $ids) {
            $this->assertSame(422, $this->adminPlanApi('assign', ['staff_id' => $this->a->id, 'plan_ids' => $ids])[0]);
            $this->assertSame(2, DB::table('v2_staff_plan_permission')->count());
        }
        $this->assertSame(403, $this->adminPlanApi('assign', ['staff_id' => $this->owned->id, 'plan_ids' => []])[0]);
        $this->assertSame(200, $this->adminPlanApi('assign', ['staff_id' => $this->a->id, 'plan_ids' => []])[0]);
        $this->assertSame([], $this->api('plan/fetch')[1]['data']);
        $this->assertSame([$this->b->id], DB::table('v2_staff_plan_permission')->pluck('staff_id')->all());
        $this->assertSame(422, $this->adminPlanApi('save', ['name' => 'Invalid group', 'group_id' => 999, 'transfer_enable' => 1, 'enabled' => 1])[0]);
    }

    public function test_staff_creates_customers_only_with_enabled_granted_private_plans(): void
    {
        $allowed = $this->privatePlan(); $this->grantPlan($allowed);
        $ungranted = $this->privatePlan('Another plan', 2); $this->grantPlan($ungranted, $this->b);
        $disabled = $this->privatePlan('Disabled', 1, false); $this->grantPlan($disabled);
        $payload = ['email' => 'new-private@example.com', 'password' => 'password123'];
        foreach ([$ungranted->id, $disabled->id, 999] as $id) {
            $this->assertSame(422, $this->api('user/create', $payload + ['staff_plan_id' => $id], 'POST')[0]);
            $this->assertSame(1, User::where('staff_owner_id', $this->a->id)->count());
        }
        [$status, $body] = $this->api('user/create', $payload + ['staff_plan_id' => $allowed->id], 'POST');
        $this->assertSame(200, $status);
        $customer = User::find($body['data']['id']);
        $this->assertSame($allowed->id, $customer->staff_plan_id);
        $this->assertNull($customer->plan_id); $this->assertSame(1, $customer->group_id);
        $this->assertSame(100 * 1073741824, $customer->transfer_enable);
        $this->assertSame(50, $customer->speed_limit); $this->assertSame(2, $customer->device_limit);
        $this->assertSame($allowed->name, $body['data']['staff_plan_name']);
        foreach (['plan_id', 'group_id', 'device_limit'] as $key) $this->assertArrayNotHasKey($key, $body['data']);
    }

    public function test_staff_plan_changes_preserve_usage_expiry_and_customer_scope(): void
    {
        $first = $this->privatePlan(); $second = $this->privatePlan('Staff B group', 2);
        $this->grantPlan($first); $this->grantPlan($second);
        $this->owned->update(['staff_plan_id' => $first->id, 'group_id' => 1, 'u' => 123, 'd' => 456, 'expired_at' => 1999999999]);
        $payload = ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0];
        $this->assertSame(200, $this->api('user/update', $payload + ['staff_plan_id' => $second->id], 'POST')[0]);
        $customer = $this->owned->fresh();
        $this->assertSame($second->id, $customer->staff_plan_id); $this->assertSame(2, $customer->group_id);
        $this->assertSame(123, $customer->u); $this->assertSame(456, $customer->d); $this->assertSame(1999999999, $customer->expired_at);
        $this->assertSame(100 * 1073741824, $customer->transfer_enable);
        $this->assertSame(404, $this->api('user/update', ['id' => $this->other->id, 'email' => $this->other->email,
            'banned' => 0, 'staff_plan_id' => $first->id], 'POST')[0]);
        $assigned = User::create(['email' => 'assigned@example.com', 'staff_owner_id' => $this->a->id]);
        $this->assertSame(404, $this->api('user/update', ['id' => $assigned->id, 'email' => $assigned->email,
            'banned' => 0, 'staff_plan_id' => $first->id], 'POST')[0]);
        DB::table('v2_staff_plan_permission')->where('staff_id', $this->a->id)->where('staff_plan_id', $second->id)->delete();
        $this->assertSame(200, $this->api('user/update', $payload + ['remarks' => 'Ordinary edit'], 'POST')[0]);
        $this->assertSame($second->id, $this->owned->fresh()->staff_plan_id);
        $this->assertSame(2, $this->owned->fresh()->group_id);
        $this->assertSame(422, $this->api('user/update', $payload + ['staff_plan_id' => $second->id], 'POST')[0]);
        $first->update(['enabled' => false]);
        $this->assertSame(422, $this->api('user/update', $payload + ['staff_plan_id' => $first->id], 'POST')[0]);
        $this->assertSame(200, $this->api('user/update', $payload + ['staff_plan_id' => null], 'POST')[0]);
        $this->assertNull($this->owned->fresh()->staff_plan_id); $this->assertNull($this->owned->fresh()->group_id);
        $this->assertSame(123, $this->owned->fresh()->u); $this->assertSame(1999999999, $this->owned->fresh()->expired_at);
    }

    public function test_admin_customer_edits_preserve_private_plan_until_a_main_plan_is_selected(): void
    {
        $plan = $this->privatePlan();
        $this->owned->update(['staff_plan_id' => $plan->id, 'group_id' => 1]);
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $payload = ['id' => $this->owned->id, 'email' => $this->owned->email, 'banned' => 0, 'is_admin' => 0, 'is_staff' => 0, 'plan_id' => null];
        $path = '/api/v1/staff-test-admin/user/update';
        [$status, $body] = $this->api('/api/v1/staff-test-admin/user/getUserInfoById', ['id' => $this->owned->id], 'GET', $token);
        $this->assertSame(200, $status); $this->assertSame($plan->name, $body['data']['staff_plan_name']);
        [$status, $body] = $this->api('/api/v1/staff-test-admin/user/fetch', [], 'GET', $token);
        $this->assertSame(200, $status);
        $row = array_values(array_filter($body['data'], function ($row) { return $row['id'] === $this->owned->id; }))[0];
        $this->assertSame('Staff · ' . $plan->name, $row['plan_name']);
        $this->assertSame(200, $this->api($path, $payload, 'POST', $token)[0]);
        $this->assertSame($plan->id, $this->owned->fresh()->staff_plan_id); $this->assertSame(1, $this->owned->fresh()->group_id);
        DB::table('v2_plan')->insert(['id' => 77, 'name' => 'Main plan', 'group_id' => 2, 'device_limit' => 5]);
        $payload['plan_id'] = 77;
        $this->assertSame(200, $this->api($path, $payload, 'POST', $token)[0]);
        $this->assertNull($this->owned->fresh()->staff_plan_id);
        $this->assertSame(77, $this->owned->fresh()->plan_id); $this->assertSame(2, $this->owned->fresh()->group_id);
    }

    public function test_purchasing_main_plans_clears_private_assignment(): void
    {
        $private = $this->privatePlan();
        DB::table('v2_plan')->insert(['id' => 77, 'name' => 'Main plan', 'group_id' => 2, 'transfer_enable' => 20, 'speed_limit' => 30]);
        foreach (['month_price', 'onetime_price'] as $period) {
            $this->owned->update(['staff_plan_id' => $private->id, 'plan_id' => null, 'group_id' => 1]);
            $order = \App\Models\Order::create(['user_id' => $this->owned->id, 'plan_id' => 77, 'type' => 1, 'period' => $period]);
            (new \App\Services\OrderService($order))->open();
            $this->assertNull($this->owned->fresh()->staff_plan_id);
            $this->assertSame(77, $this->owned->fresh()->plan_id);
            $this->assertSame(2, $this->owned->fresh()->group_id);
            $this->assertSame(3, $order->fresh()->status);
        }
    }

    public function test_main_plan_giftcard_clears_private_assignment(): void
    {
        DB::connection()->getSchemaBuilder()->create('v2_giftcard', function (Blueprint $table) {
            $table->increments('id'); $table->string('code'); $table->integer('type'); $table->integer('value');
            $table->integer('plan_id'); $table->text('used_user_ids')->nullable(); $table->integer('limit_use')->nullable();
            $table->integer('created_at')->nullable(); $table->integer('updated_at')->nullable();
        });
        $private = $this->privatePlan();
        $this->owned->update(['staff_plan_id' => $private->id, 'group_id' => 1]);
        DB::table('v2_plan')->insert(['id' => 77, 'name' => 'Main plan', 'group_id' => 2]);
        \App\Models\Giftcard::create(['code' => 'test-main-plan', 'type' => 5, 'value' => 30, 'plan_id' => 77]);
        $request = \App\Http\Requests\User\UserRedeemGiftCard::create('/', 'POST', ['user' => ['id' => $this->owned->id], 'giftcard' => 'test-main-plan']);
        $response = (new \App\Http\Controllers\V1\User\UserController())->redeemgiftcard($request);
        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($this->owned->fresh()->staff_plan_id); $this->assertSame(77, $this->owned->fresh()->plan_id);
    }

    public function test_cleanup_does_not_remove_a_customer_assigned_a_private_plan(): void
    {
        $plan = $this->privatePlan();
        $this->owned->update(['staff_plan_id' => $plan->id, 'expired_at' => 0, 'transfer_enable' => 0]);
        $empty = User::create(['email' => 'empty-account@example.com', 'expired_at' => 0]);
        $command = new \App\Console\Commands\ClearUser();
        $command->setOutput(new \Illuminate\Console\OutputStyle(new \Symfony\Component\Console\Input\ArrayInput([]), new \Symfony\Component\Console\Output\BufferedOutput()));
        $command->handle();
        $this->assertNotNull($this->owned->fresh()); $this->assertNull($empty->fresh());
    }

    public function test_horizon_accepts_panel_jwt_without_a_laravel_guard_session(): void
    {
        $this->app->instance('env', 'production');
        (new \App\Providers\HorizonServiceProvider($this->app))->boot();
        $token = (new AuthService($this->admin))->generateAuthData(Request::create('/'))['auth_data'];
        $request = Request::create('/monitor/api/stats');
        $request->headers->set('Authorization', $token);
        $request->setUserResolver(function () { return null; });
        $this->assertTrue(\Laravel\Horizon\Horizon::check($request));
        $middleware = new \Laravel\Horizon\Http\Middleware\Authenticate();
        $response = (new \App\Http\Middleware\Admin())->handle($request, function ($request) use ($middleware) {
            return $middleware->handle($request, function () { return response()->json(['status' => 'running']); });
        });
        $this->assertSame(200, $response->getStatusCode());
        $this->admin->update(['banned' => 1]);
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        $this->admin->update(['banned' => 0, 'is_admin' => 0]);
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        $this->admin->update(['is_admin' => 1]);
        $this->assertTrue(\Laravel\Horizon\Horizon::check($request));
        (new AuthService($this->admin))->removeAllSession();
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        \Laravel\Horizon\Horizon::auth(function () { return false; });
    }

    public function test_horizon_rejects_staff_guests_and_forged_identity_even_in_local_environment(): void
    {
        $this->app->instance('env', 'local');
        (new \App\Providers\HorizonServiceProvider($this->app))->boot();
        $request = Request::create('/monitor/api/stats', 'GET', ['user' => ['id' => $this->admin->id, 'is_admin' => 1]]);
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        $request->headers->set('Authorization', $this->token);
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        $request->headers->set('Authorization', 'invalid-token');
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        $request->headers->remove('Authorization');
        $request->merge(['auth_data' => ['invalid' => 'type']]);
        $this->assertFalse(\Laravel\Horizon\Horizon::check($request));
        \Laravel\Horizon\Horizon::auth(function () { return false; });
    }

    public function test_admin_retains_ticket_reply_permission(): void
    {
        $jobs = [];
        $this->app->instance(\Illuminate\Contracts\Bus\Dispatcher::class, new class($jobs) {
            private $jobs;
            public function __construct(&$jobs) { $this->jobs =& $jobs; }
            public function dispatch($job) { $this->jobs[] = $job; }
        });
        $ticket = Ticket::create(['user_id' => $this->owned->id, 'subject' => 'Own']);
        (new \App\Services\TicketService())->replyByAdmin($ticket->id, 'Admin reply', $this->admin->id);
        $this->assertSame('Admin reply', DB::table('v2_ticket_message')->value('message'));
        $this->assertSame($this->admin->id, DB::table('v2_ticket_message')->value('user_id'));
        $this->assertCount(1, $jobs);
    }

}
