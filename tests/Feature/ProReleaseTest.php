<?php

namespace Tests\Feature;

use App\Services\EnvironmentFileService;
use Dotenv\Dotenv;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class ProReleaseTest extends TestCase
{
    public function test_environment_values_round_trip_without_interpolation_or_line_injection(): void
    {
        $service = new EnvironmentFileService();
        foreach (['secret#value', 'space value', 'quote"and\'apostrophe', '${APP_NAME}\\path$word', 'null', '', 'mật khẩu 🌟'] as $secret) {
            $rendered = $service->render("APP_NAME=Other\nDB_PASSWORD=old\nDB_DATABASE=keep\n", ['DB_PASSWORD' => $secret]);
            $loaded = Dotenv::parse($rendered);
            $this->assertSame($secret, $loaded['DB_PASSWORD']);
            $this->assertSame('keep', $loaded['DB_DATABASE']);
        }
        $this->expectException(RuntimeException::class);
        $service->render('DB_PASSWORD=old', ['DB_PASSWORD' => "bad\nAPP_DEBUG=true"]);
    }

    public function test_release_removes_only_movie_module_and_install_sql_is_non_destructive(): void
    {
        $root = dirname(__DIR__, 2);
        $this->assertDirectoryDoesNotExist($root . '/public/xem-phim');
        $this->assertDoesNotMatchRegularExpression('/\bDROP TABLE\b/i', file_get_contents($root . '/database/install.sql'));
        foreach (['public/check_user.php', 'worker.js', 'webman.php', 'start.php', 'cli-php.ini', 'pm2.yaml', 'optimize-server.sh', 'database/update.sql'] as $path) $this->assertFileExists($root . '/' . $path);
    }

    public function test_vietnamese_translation_covers_existing_messages_and_preserves_parameters(): void
    {
        $root = dirname(__DIR__, 2);
        $english = json_decode(file_get_contents($root . '/resources/lang/en-US.json'), true, 512, JSON_THROW_ON_ERROR);
        $vietnamese = json_decode(file_get_contents($root . '/resources/lang/vi-VN.json'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(array_keys($english), array_keys($vietnamese));
        foreach ($english as $key => $message) {
            preg_match_all('/:[a-z_]+/', $key, $expected);
            preg_match_all('/:[a-z_]+/', $vietnamese[$key], $actual);
            sort($expected[0]); sort($actual[0]);
            $this->assertSame($expected[0], $actual[0], $key);
            $this->assertNotSame('', $vietnamese[$key]);
        }
    }
}
