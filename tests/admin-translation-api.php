<?php

// php tests/admin-translation-api.php
// V2PRO_TEST_AUTOLOAD may point at a separate, compatible Composer autoloader.
$root = dirname(__DIR__);
require getenv('V2PRO_TEST_AUTOLOAD') ?: $root . '/vendor/autoload.php';
require_once $root . '/app/Http/Middleware/Admin.php';
require_once $root . '/app/Exceptions/Handler.php';

use Illuminate\Config\Repository;
use Illuminate\Events\Dispatcher;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Translation\FileLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

function verifyAdminTranslation($condition, $message)
{
    if (!$condition) throw new RuntimeException($message);
}

$app = new Application($root);
$app->instance('config', new Repository(['app' => ['locale' => 'en-US', 'fallback_locale' => 'en-US', 'debug' => false]]));
$app->instance('events', new Dispatcher($app));
$app->instance('files', new Filesystem());
$app['config']->set('view.paths', [$root . '/resources/views']);
$app['config']->set('view.compiled', sys_get_temp_dir());
$app->register(Illuminate\View\ViewServiceProvider::class);
$translator = new Translator(new FileLoader(new Filesystem(), $root . '/resources/lang'), 'en-US');
$app->instance('translator', $translator);
$validator = new Factory($translator, $app);
$handler = new App\Exceptions\Handler($app);
$request = Request::create('/api/v1/test-admin/plan/save', 'POST');
$request->headers->set('accept', 'application/json');
$app->instance('request', $request);

// Non-admin errors retain the existing response and language.
$response = $handler->render($request, new HttpException(500, '保存失败'));
verifyAdminTranslation($response->getData(true)['message'] === '保存失败', 'User API language changed');

// No credentials are used: the real admin middleware must localize even 403.
try {
    (new App\Http\Middleware\Admin())->handle($request, function () {
        throw new RuntimeException('Unauthenticated request reached controller');
    });
    throw new RuntimeException('Missing admin authorization was accepted');
} catch (HttpException $error) {
    $response = $handler->render($request, $error);
    verifyAdminTranslation($response->getStatusCode() === 403, 'Admin authorization status changed');
    verifyAdminTranslation($response->getData(true)['message'] === 'Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn', 'Admin auth message was not localized');
}

// Translate legacy custom messages and native Laravel rules in the same response.
verifyAdminTranslation($app->getLocale() === 'en-US', 'Admin locale leaked into later requests');
$app->setLocale('vi-VN');
$validation = $validator->make(['port' => 'abc'], ['name' => 'required', 'port' => 'integer'], ['name.required' => '名称不能为空']);
$validation->fails();
$exception = new ValidationException($validation);
$app->setLocale('en-US');
$response = $handler->render($request, $exception);
$data = $response->getData(true);
verifyAdminTranslation($response->getStatusCode() === 422, 'Validation status changed');
verifyAdminTranslation($data['errors']['name'] === ['Vui lòng nhập tên'], 'Legacy validation message was not localized');
verifyAdminTranslation($data['errors']['port'] === ['cổng kết nối phải là số nguyên.'], 'Native validation rule was not localized');
verifyAdminTranslation(!preg_match('/\p{Han}/u', json_encode($data, JSON_UNESCAPED_UNICODE)), 'Chinese remains in admin errors');

foreach ([403, 404, 500] as $status) {
    $response = $handler->render($request, new HttpException($status, '服务器不存在'));
    verifyAdminTranslation($response->getStatusCode() === $status, 'HTTP status changed');
    verifyAdminTranslation($response->getData(true)['message'] === 'Máy chủ không tồn tại', 'Legacy controller message was not localized');
}
verifyAdminTranslation($translator->get('The current required minimum withdrawal commission is :limit', ['limit' => '100'], 'vi-VN') === 'Số hoa hồng tối thiểu để rút là 100', 'Interpolation was lost');

// Every literal admin error must have a translation; API rule/operator values stay intact.
$dictionary = json_decode(file_get_contents($root . '/resources/lang/vi-VN.json'), true);
foreach (['app/Http/Controllers/V1/Admin', 'app/Http/Requests/Admin'] as $directory) {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/' . $directory)) as $file) {
        if ($file->getExtension() !== 'php') continue;
        $code = file_get_contents($file->getPathname());
        preg_match_all('/(?:abort\(\d+,\s*|\$fail\()([\'\"])([^\'\"]*\p{Han}[^\'\"]*)\1/u', $code, $matches);
        foreach ($matches[2] as $message) verifyAdminTranslation(isset($dictionary[$message]), 'Missing error: ' . $message);
    }
}
echo "Admin API localization passed (403/404/422/500, validation, user locale, interpolation).\n";
