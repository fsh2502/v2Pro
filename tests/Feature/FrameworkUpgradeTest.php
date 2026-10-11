<?php

namespace Tests\Feature;

use App\Jobs\SendEmailJob;
use App\Logging\MysqlLoggerHandler;
use App\Models\User;
use App\Services\AuthService;
use App\Services\MailConfigurationService;
use App\Utils\CacheKey;
use App\Utils\Helper;
use Illuminate\Config\Repository;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Mail;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class FrameworkUpgradeTest extends TestCase
{
    private Application $app;

    protected function setUp(): void
    {
        parent::setUp();
        Facade::clearResolvedInstances();
        $root = dirname(__DIR__, 2);
        $this->app = new Application($root);
        $this->app->instance('request', Request::create('https://example.test/'));
        $this->app->instance('config', new Repository([
            'app' => ['key' => 'base64:' . base64_encode(str_repeat('k', 32)), 'url' => 'https://example.test'],
            'database' => ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]],
            'cache' => ['default' => 'array', 'stores' => ['array' => ['driver' => 'array']]],
            'view' => ['paths' => [$root . '/resources/views'], 'compiled' => sys_get_temp_dir()],
            'mail' => require $root . '/config/mail.php',
            'v2board' => [],
        ]));
        Facade::setFacadeApplication($this->app);
        foreach ([
            \Illuminate\Events\EventServiceProvider::class,
            \Illuminate\Filesystem\FilesystemServiceProvider::class,
            \Illuminate\Routing\RoutingServiceProvider::class,
            \Illuminate\Database\DatabaseServiceProvider::class,
            \Illuminate\Cache\CacheServiceProvider::class,
            \Illuminate\View\ViewServiceProvider::class,
            \Illuminate\Mail\MailServiceProvider::class,
        ] as $provider) $this->app->register($provider);
        $this->app->boot();
        config(['mail.default' => 'smtp', 'mail.from.address' => 'default@example.test']);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        parent::tearDown();
    }

    public function test_login_accepts_legacy_identifiers(): void
    {
        $translator = new \Illuminate\Translation\Translator(new \Illuminate\Translation\ArrayLoader(), 'en');
        $factory = new \Illuminate\Validation\Factory($translator, $this->app);
        $rules = (new \App\Http\Requests\Passport\AuthLogin())->rules();
        foreach (['1234@1', 'admin@test', 'legacy-user', 'normal@example.com', 'user+tag@example.com'] as $email) {
            $this->assertTrue($factory->make(['email' => $email, 'password' => 'isolated-password'], $rules)->passes(), $email);
        }
        foreach (['', null, ['1234@1'], 1234, str_repeat('a', 256)] as $email) {
            $this->assertTrue($factory->make(['email' => $email, 'password' => 'isolated-password'], $rules)->fails());
        }
        $this->assertTrue($factory->make(['email' => 'admin@test', 'password' => 'short'], $rules)->fails());
    }

    public function test_account_address_validation_does_not_require_a_dotted_domain(): void
    {
        $translator = new \Illuminate\Translation\Translator(new \Illuminate\Translation\ArrayLoader(), 'en');
        $this->app->instance('translator', $translator);
        $factory = new \Illuminate\Validation\Factory($translator, $this->app);
        foreach ([
            \App\Http\Requests\Passport\AuthRegister::class,
            \App\Http\Requests\Passport\AuthForget::class,
            \App\Http\Requests\Passport\CommSendEmailVerify::class,
            \App\Http\Requests\Admin\UserUpdate::class,
            \App\Http\Requests\Staff\UserCreate::class,
            \App\Http\Requests\Staff\UserUpdate::class,
        ] as $request) {
            $emailRules = (new $request())->rules()['email'];
            foreach (['1234@1', 'user@abc', 'admin@test', 'normal@example.com', 'user+tag@example.com', str_repeat('a', 62) . '@1'] as $email) {
                $this->assertTrue($factory->make(['email' => $email], ['email' => $emailRules])->passes(), $request . ': ' . $email);
            }
            foreach (['', 'missing-at', '@1', 'user@', 'user@@1', 'user name@1', "user@1\n", "user\0@1", str_repeat('a', 63) . '@1', null, ['user@1'], 1234] as $email) {
                $this->assertTrue($factory->make(['email' => $email], ['email' => $emailRules])->fails(), $request);
            }
        }
    }

    public function test_panel_smtp_tls_settings_replace_cached_transport_without_connecting(): void
    {
        config(['v2board' => [
            'email_host' => 'first.example.test', 'email_port' => 587,
            'email_username' => 'first-user', 'email_password' => 'first-password',
            'email_encryption' => 'tls', 'email_from_address' => 'first@example.test',
            'app_name' => 'First brand',
        ], 'mail.mailers.smtp.url' => 'smtp://stale.example.test:25']);
        MailConfigurationService::applyPanelSettings();
        $firstMailer = Mail::mailer('smtp');
        $first = $firstMailer->getSymfonyTransport();
        $this->assertSame('first.example.test', $first->getStream()->getHost());
        $this->assertSame(587, $first->getStream()->getPort());
        $this->assertSame('first-user', $first->getUsername());
        $this->assertSame('first-password', $first->getPassword());
        $this->assertTrue($first->isTlsRequired());
        $this->assertFalse($first->getStream()->isTLS());
        $this->assertNull(config('mail.mailers.smtp.url'));

        config(['v2board.email_host' => 'second.example.test', 'v2board.email_password' => 'new-password']);
        MailConfigurationService::applyPanelSettings();
        $second = Mail::mailer('smtp')->getSymfonyTransport();
        $this->assertNotSame($first, $second);
        $this->assertSame('second.example.test', $second->getStream()->getHost());
        $this->assertSame('new-password', $second->getPassword());
    }

    public function test_panel_ssl_uses_encrypted_socket_and_preserves_from_fallback(): void
    {
        config(['v2board' => ['email_host' => 'ssl.example.test', 'email_port' => 465, 'email_encryption' => 'ssl']]);
        MailConfigurationService::applyPanelSettings();
        $transport = Mail::mailer('smtp')->getSymfonyTransport();
        $this->assertTrue($transport->getStream()->isTLS());
        $this->assertSame(465, $transport->getStream()->getPort());
        $this->assertSame('default@example.test', config('mail.from.address'));
    }

    public function test_mailgun_and_postmark_transports_have_the_required_symfony_bridges(): void
    {
        config([
            'services.mailgun' => ['domain' => 'mail.example.test', 'secret' => 'isolated-dummy-key', 'endpoint' => 'api.mailgun.net'],
            'services.postmark.token' => 'isolated-dummy-key',
        ]);
        foreach (['mailgun' => 'Mailgun', 'postmark' => 'Postmark'] as $mailer => $bridge) {
            // Only construct the transports; do not connect to either service.
            $transport = Mail::mailer($mailer)->getSymfonyTransport();
            $this->assertInstanceOf(\Symfony\Component\Mailer\Transport\TransportInterface::class, $transport);
            $this->assertStringStartsWith('Symfony\\Component\\Mailer\\Bridge\\' . $bridge . '\\', get_class($transport));
        }
    }

    public function test_email_job_renders_and_logs_using_array_transport_despite_panel_smtp(): void
    {
        DB::connection()->getSchemaBuilder()->create('v2_mail_log', function (Blueprint $table) {
            $table->increments('id');
            foreach (['email', 'subject', 'template_name'] as $field) $table->string($field);
            $table->text('error')->nullable();
            $table->integer('created_at'); $table->integer('updated_at');
        });
        config(['mail.default' => 'array', 'v2board.email_host' => 'never-connect.example.test']);
        $job = new SendEmailJob([
            'email' => 'recipient@example.test', 'subject' => 'Upgrade regression',
            'template_name' => 'verify', 'template_value' => ['name' => 'Regression', 'code' => '654321', 'url' => 'https://example.test'],
        ]);
        $result = $job->handle();
        $this->assertNull($result['error']);
        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $email = $messages->first()->getOriginalMessage();
        $this->assertSame('Upgrade regression', $email->getSubject());
        $this->assertStringContainsString('654321', $email->getHtmlBody());
        $this->assertSame('recipient@example.test', $email->getTo()[0]->getAddress());
        $this->assertSame(1, DB::table('v2_mail_log')->whereNull('error')->count());
    }

    public function test_monolog_three_writes_database_record_and_omits_request_credentials(): void
    {
        DB::connection()->getSchemaBuilder()->create('v2_log', function (Blueprint $table) {
            $table->increments('id');
            foreach (['title', 'level', 'host', 'uri', 'method', 'ip', 'data', 'context'] as $field) $table->text($field)->nullable();
            $table->integer('created_at'); $table->integer('updated_at');
        });
        $request = Request::create('https://example.test/login', 'POST', [
            'email' => 'qa@example.test', 'password' => 'secret', 'auth_data' => 'jwt-secret', 'token' => 'subscription-secret',
        ]);
        $this->app->instance('request', $request);
        $logger = new Logger('upgrade', [new MysqlLoggerHandler()]);
        $logger->error('Synthetic upgrade error', ['exception' => new \RuntimeException('synthetic')]);
        $record = DB::table('v2_log')->first();
        $this->assertNotNull($record);
        $this->assertSame('ERROR', $record->level);
        $this->assertSame('POST', $record->method);
        $this->assertSame(['email' => 'qa@example.test'], json_decode($record->data, true));
        $this->assertGreaterThan(0, $record->created_at);
        $this->assertSame($record->created_at, $record->updated_at);
    }

    public function test_existing_hs256_session_remains_valid_without_rotating_application_key(): void
    {
        DB::connection()->getSchemaBuilder()->create('v2_user', function (Blueprint $table) {
            $table->increments('id'); $table->string('email');
            $table->integer('is_admin'); $table->integer('is_staff');
        });
        DB::table('v2_user')->insert(['id' => 17, 'email' => 'legacy@example.test', 'is_admin' => 1, 'is_staff' => 0]);
        $encode = fn ($value) => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
        $unsigned = $encode('{"typ":"JWT","alg":"HS256"}') . '.' . $encode('{"id":17,"session":"legacy-session"}');
        $jwt = $unsigned . '.' . $encode(hash_hmac('sha256', $unsigned, config('app.key'), true));
        Cache::put(CacheKey::get('USER_SESSIONS', 17), ['legacy-session' => ['auth_data' => $jwt]]);
        $this->assertSame(17, AuthService::decryptAuthData($jwt)['id']);
        (new AuthService(User::find(17)))->removeSession('legacy-session');
        $this->assertFalse(AuthService::decryptAuthData($jwt));
    }

    public function test_missing_subscription_domain_uses_existing_application_url(): void
    {
        $this->assertSame('https://example.test/api/v1/client/subscribe?token=example-token', Helper::getSubscribeUrl('example-token'));
    }

    public function test_theme_render_failure_returns_a_response_without_exposing_internal_details(): void
    {
        config(['app.debug' => false]);
        $request = Request::create('/');
        $request->headers->set('Accept', 'application/json');
        $response = (new \App\Exceptions\Handler($this->app))->render(
            $request, new \Illuminate\View\ViewException('internal-private-path')
        );
        $this->assertSame(500, $response->getStatusCode());
        $this->assertStringContainsString('cấu hình theme', json_decode($response->getContent(), true)['message']);
        $this->assertStringNotContainsString('internal-private-path', $response->getContent());
    }
}
