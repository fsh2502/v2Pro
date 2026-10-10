<?php

// Real Laravel view/service checks with isolated paths and a mocked cache command.
// No .env, database, Redis or live website is loaded.
require __DIR__ . '/staff-bootstrap.php';

use App\Services\ThemeService;
use Illuminate\Config\Repository;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Facade;

$root = dirname(__DIR__);
$scratch = $root . '/artifacts/ios-glass-20261010/php-smoke';
if (!is_dir($scratch)) mkdir($scratch, 0777, true);
$app = new Application($scratch);
$app->instance('request', Illuminate\Http\Request::create('http://localhost/'));
$app->instance('path.public', $root . '/public');
$app->instance('config', new Repository([
    'app' => ['url' => 'http://localhost'],
    'view' => ['paths' => [$root . '/resources/views'], 'compiled' => $scratch],
]));
Facade::setFacadeApplication($app);
foreach ([Illuminate\Events\EventServiceProvider::class,
    Illuminate\Filesystem\FilesystemServiceProvider::class,
    Illuminate\Routing\RoutingServiceProvider::class,
    Illuminate\View\ViewServiceProvider::class] as $provider) $app->register($provider);
$app->boot();
$kernel = Mockery::mock(Illuminate\Contracts\Console\Kernel::class);
$kernel->shouldReceive('call')->once()->with('config:cache')->andReturn(0);
$app->instance(Illuminate\Contracts\Console\Kernel::class, $kernel);

(new ThemeService('ios-glass'))->init();
if (config('theme.ios-glass.appearance') !== 'system' ||
    !is_file($scratch . '/config/theme/ios-glass.php')) {
    throw new RuntimeException('First theme initialization did not publish/write defaults.');
}
$app['view']->addNamespace('theme', $root . '/public/theme');
$html = $app['view']->make('theme::ios-glass.dashboard', [
    'title' => 'Tên <script>alert(1)</script>', 'logo' => '',
    'description' => 'Mô tả thử nghiệm', 'theme_config' => config('theme.ios-glass'),
])->render();
if (strpos($html, '<script>alert(1)</script>') !== false ||
    strpos($html, 'window.iosGlass') === false || strpos($html, 'demo/server') !== false) {
    throw new RuntimeException('Blade escaping/production entry regression.');
}
preg_match_all('~(?:src|href)="http://localhost(/theme/ios-glass/assets/[^"?]+)~', $html, $matches);
if (count($matches[1]) < 2) throw new RuntimeException('Missing JS/CSS entry.');
foreach ($matches[1] as $asset) {
    if (!is_file($root . '/public' . $asset)) throw new RuntimeException('Missing hashed asset: ' . $asset);
}
Mockery::close();
echo "iOS Glass: initialization, Blade escaping and manifest assets passed.\n";
