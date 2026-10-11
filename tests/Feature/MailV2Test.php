<?php

namespace Tests\Feature;

use App\Jobs\SendEmailJob;
use App\Models\User;
use App\Services\MailService;
use App\Services\MailTemplateService;
use Illuminate\Config\Repository;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use PHPUnit\Framework\TestCase;

class MailV2Test extends TestCase
{
    private Application $app;

    protected function setUp(): void
    {
        parent::setUp();
        Facade::clearResolvedInstances();
        $root = dirname(__DIR__, 2);
        $this->app = new Application($root);
        $this->app->instance('config', new Repository([
            'app' => ['url' => 'https://example.test', 'timezone' => 'Asia/Tokyo'],
            'v2board' => ['app_name' => '🇯🇵SHOPTUANTRUONG🇻🇳', 'app_url' => 'https://example.test', 'frontend_theme' => 'ios-glass'],
            'view' => ['paths' => [$root . '/resources/views'], 'compiled' => sys_get_temp_dir()],
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
            'cache' => ['default' => 'array', 'stores' => ['array' => ['driver' => 'array']]],
        ]));
        Facade::setFacadeApplication($this->app);
        foreach ([
            \Illuminate\Events\EventServiceProvider::class,
            \Illuminate\Filesystem\FilesystemServiceProvider::class,
            \Illuminate\View\ViewServiceProvider::class,
            \Illuminate\Database\DatabaseServiceProvider::class,
            \Illuminate\Cache\CacheServiceProvider::class,
            \Illuminate\Translation\TranslationServiceProvider::class,
            \Illuminate\Bus\BusServiceProvider::class,
        ] as $provider) $this->app->register($provider);
        $this->app->boot();
        Bus::fake();
        DB::connection()->getSchemaBuilder()->create('v2_user', function (Blueprint $table) {
            $table->increments('id'); $table->string('email');
            $table->integer('plan_id')->nullable(); $table->integer('staff_plan_id')->nullable();
            $table->bigInteger('u')->default(0); $table->bigInteger('d')->default(0); $table->bigInteger('transfer_enable')->default(0);
            $table->bigInteger('expired_at')->nullable(); $table->integer('remind_traffic')->default(1);
        });
        foreach (['v2_plan', 'v2_staff_plan'] as $name) {
            DB::connection()->getSchemaBuilder()->create($name, function (Blueprint $table) {
                $table->increments('id'); $table->string('name');
            });
        }
        DB::table('v2_plan')->insert(['id' => 1, 'name' => 'Premium 100 GB']);
        DB::table('v2_staff_plan')->insert(['id' => 2, 'name' => 'Gói CTV riêng']);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    private function render(string $template, array $data = []): string
    {
        return $this->app['view']->make('mail.mail v2.' . $template, $data + [
            'name' => '🇯🇵SHOPTUANTRUONG🇻🇳', 'url' => 'https://example.test',
        ])->render();
    }

    private function dispatchedData(): array
    {
        return Bus::dispatched(SendEmailJob::class)->map(fn ($job) => (new \ReflectionProperty($job, 'params'))->getValue($job))->all();
    }

    public function test_all_templates_render_legacy_payloads_and_unicode_brand(): void
    {
        foreach ([
            'verify' => ['code' => '482916'], 'notify' => ['content' => "Dòng một\nDòng hai"],
            'mailLogin' => ['link' => 'https://example.test/#/login?verify=synthetic'],
            'remindExpire' => [], 'remindTraffic' => [],
        ] as $template => $data) {
            $html = $this->render($template, $data);
            $this->assertStringContainsString('🇯🇵SHOPTUANTRUONG🇻🇳', $html);
            $this->assertStringContainsString('https://example.test/#/support', $html);
            $this->assertStringNotContainsString('{{', $html);
            $this->assertStringNotContainsString('0.00 / 0.00', $html);
            preg_match_all('~src="https://example.test(/assets/mail-v2/[^"?]+)"~', $html, $matches);
            $this->assertCount(2, $matches[1]);
            foreach ($matches[1] as $asset) $this->assertFileExists(dirname(__DIR__, 2) . '/public' . $asset);
        }
    }

    public function test_notification_content_is_escaped_and_preserves_line_breaks(): void
    {
        $html = $this->render('notify', ['name' => '<img src=x onerror=alert(1)>', 'content' => "<script>alert(1)</script>\nXin chào"]);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('<img src=x', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringContainsString('<br />', $html);
        $this->assertStringContainsString('Xin chào', $html);
    }

    public function test_login_button_uses_the_login_link_and_unsafe_links_are_not_rendered(): void
    {
        $link = 'https://example.test/#/login?verify=synthetic&redirect=profile';
        $html = $this->render('mailLogin', ['link' => $link]);
        $this->assertStringContainsString('href="' . e($link) . '" target="_blank"', $html);
        foreach (['javascript:alert(1)', 'data:text/html,unsafe', '//other.test/path', "https://example.test/\nunsafe", 'https://user:password@example.test/'] as $unsafe) {
            $this->assertNull(MailTemplateService::safeHttpUrl($unsafe));
            $html = $this->render('mailLogin', ['link' => $unsafe, 'url' => $unsafe]);
            $this->assertStringNotContainsString('href="' . e($unsafe) . '"', $html);
        }
    }

    public function test_primary_routes_follow_current_theme_and_private_plan_policy(): void
    {
        $this->assertStringContainsString('href="https://example.test/#/plans"', $this->render('remindExpire'));
        $this->assertStringNotContainsString('href="https://example.test/#/plans"', $this->render('remindExpire', ['renew_route' => 'support']));
        config(['v2board.frontend_theme' => 'default']);
        $html = $this->render('remindExpire');
        $this->assertStringContainsString('href="https://example.test/#/plan"', $html);
        $this->assertStringContainsString('href="https://example.test/#/ticket"', $html);
    }

    public function test_expiry_data_is_localized_and_usage_progress_is_bounded(): void
    {
        $html = $this->render('remindExpire', ['expires_at' => strtotime('2030-01-02T03:04:00Z'), 'plan_name' => 'Premium <100 GB>']);
        $this->assertStringContainsString('02/01/2030 12:04', $html);
        $this->assertStringContainsString('UTC+09:00', $html);
        $this->assertStringContainsString('Premium &lt;100 GB&gt;', $html);
        foreach ([-10 => 0, 95 => 95, 120 => 100] as $input => $expected) {
            $html = $this->render('remindTraffic', ['usage_percent' => $input, 'used_gb' => '95.00', 'total_gb' => '100.00', 'remaining_gb' => '5.00']);
            $this->assertStringContainsString('sử dụng ' . $expected . '%', $html);
            $this->assertStringNotContainsString('width:120%', $html);
            $this->assertStringNotContainsString('width:-10%', $html);
        }
    }

    public function test_traffic_mail_uses_real_upload_and_download_totals_and_keeps_throttle(): void
    {
        $user = (new User())->forceFill(['id' => 1, 'email' => 'isolated@example.test', 'plan_id' => 1,
            'u' => 10 * 1073741824, 'd' => 85 * 1073741824, 'transfer_enable' => 100 * 1073741824, 'remind_traffic' => 1]);
        $service = new MailService();
        $this->assertNull(\Illuminate\Support\Facades\Cache::get(\App\Utils\CacheKey::get('LAST_SEND_EMAIL_REMIND_TRAFFIC', $user->id)));
        $service->remindTraffic($user);
        $service->remindTraffic($user);
        $jobs = $this->dispatchedData();
        $this->assertCount(1, $jobs);
        $this->assertSame('remindTraffic', $jobs[0]['template_name']);
        $data = $jobs[0]['template_value'];
        $this->assertSame('95.00', $data['used_gb']);
        $this->assertSame('100.00', $data['total_gb']);
        $this->assertSame('5.00', $data['remaining_gb']);
        $this->assertEquals(95, $data['usage_percent']);
        $this->assertSame('Premium 100 GB', $data['plan_name']);
        $this->assertStringContainsString('95.00 / 100.00 GB', $this->render('remindTraffic', $data));
    }

    public function test_reminder_conditions_and_private_plan_selection_are_preserved(): void
    {
        $service = new MailService();
        foreach ([['remind_traffic' => 0, 'u' => 95], ['remind_traffic' => 1, 'u' => 94], ['remind_traffic' => 1, 'u' => 100]] as $case) {
            $user = (new User())->forceFill(['id' => 1, 'email' => 'isolated@example.test', 'remind_traffic' => $case['remind_traffic'], 'u' => $case['u'], 'd' => 0, 'transfer_enable' => 100]);
            $service->remindTraffic($user);
        }
        foreach ([null, time() - 1, time() + 172800] as $expiry) $service->remindExpire((new User())->forceFill(['expired_at' => $expiry]));
        Bus::assertNothingDispatched();
        $expiry = time() + 3600;
        $service->remindExpire((new User())->forceFill(['email' => 'isolated@example.test', 'plan_id' => 1, 'staff_plan_id' => 2, 'expired_at' => $expiry]));
        $data = $this->dispatchedData()[0]['template_value'];
        $this->assertSame('Gói CTV riêng', $data['plan_name']);
        $this->assertSame($expiry, $data['expires_at']);
        $this->assertSame('support', $data['renew_route']);
    }
}
