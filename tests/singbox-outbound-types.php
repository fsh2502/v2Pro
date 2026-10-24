<?php

// Standalone: php tests/singbox-outbound-types.php [source-root] [output-dir]
$root = $argv[1] ?? dirname(__DIR__);
$GLOBALS['singbox_test_root'] = $root;
require $root . '/app/Utils/Helper.php';
require $root . '/app/Services/NodeCertificateService.php';
require $root . '/app/Utils/TlsPin.php';
require $root . '/app/Protocols/Singbox/Singbox.php';
require $root . '/app/Protocols/Singbox/SingboxOld.php';
require $root . '/app/Protocols/Hiddify.php';

function config($key, $default = null)
{
    return $key === 'v2board.app_name' ? 'Main test' : $default;
}

function base_path($path = '')
{
    return $GLOBALS['singbox_test_root'] . ($path === '' ? '' : '/' . $path);
}

class SingboxTestResponse
{
    public $body;
    public $headers = [];

    public function __construct($body) { $this->body = $body; }
    public function header($name, $value) { $this->headers[strtolower($name)] = $value; return $this; }
}

function response($body, $status = 200) { return new SingboxTestResponse($body); }
function checkOutbound($condition, $message)
{
    if (!$condition) throw new RuntimeException($message);
}

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
$user = ['uuid' => '11111111-1111-4111-8111-111111111111', 'u' => 0, 'd' => 0,
    'transfer_enable' => 1073741824, 'expired_at' => 1798761600];
$base = [
    'type' => 'v2node', 'host' => 'node.example.com', 'port' => '443', 'tls' => 1,
    'network' => 'tcp', 'network_settings' => [], 'flow' => '',
    'tls_settings' => ['server_name' => 'node.example.com', 'fingerprint' => 'chrome'],
    'server_name' => 'node.example.com', 'insecure' => 0, 'cipher' => 'aes-128-gcm',
    'zero_rtt_handshake' => 0, 'disable_sni' => 0,
];
$servers = [];
foreach (['vless', 'vmess', 'trojan', 'shadowsocks', 'tuic', 'anytls', 'hysteria2'] as $protocol) {
    $servers[] = array_replace($base, ['protocol' => $protocol, 'name' => 'Test ' . $protocol]);
}
$legacy = array_replace($base, ['type' => 'hysteria', 'version' => 2, 'name' => 'Legacy Hysteria2']);
$servers[] = $legacy;
$configs = [];
foreach ([App\Protocols\Singbox\Singbox::class, App\Protocols\Singbox\SingboxOld::class] as $renderer) {
    $instance = new $renderer($user, $servers, ['version' => '1.12.0']);
    $method = new ReflectionMethod($renderer, 'buildProxies');
    $method->setAccessible(true);
    $proxies = $method->invoke($instance);
    checkOutbound(count($proxies) >= 7, "$renderer dropped supported nodes");
    foreach ($proxies as $proxy) {
        checkOutbound(is_int($proxy['server_port']), "$renderer {$proxy['type']}: server_port must be a JSON number, not a database string");
        checkOutbound($proxy['server_port'] === 443, "$renderer changed the server port");
        checkOutbound($proxy['server'] === 'node.example.com', "$renderer changed the node address");
    }
    // Exercise headers as well: main does not have the staff naming service.
    $response = $instance->handle();
    checkOutbound(base64_decode(substr($response->headers['profile-title'], 7)) === 'Main test', "$renderer fails without the optional staff service");
    $name = $renderer === App\Protocols\Singbox\Singbox::class ? 'modern' : 'legacy';
    $configs[$name] = ['dns' => ['servers' => [['type' => 'local', 'tag' => 'local']]], 'outbounds' => $proxies];
}

$hiddify = (new App\Protocols\Hiddify($user, $servers, ['singbox_version' => '1.13.0']))->handle();
$configs['hiddify'] = json_decode($hiddify->body, true);
checkOutbound(array_keys($configs['hiddify']) === ['outbounds'], 'Hiddify received panel TUN/DNS/routing');
foreach ($configs['hiddify']['outbounds'] as $proxy) {
    checkOutbound(is_int($proxy['server_port']), 'Hiddify received a string port');
    checkOutbound(!isset($proxy['domain_resolver']), 'Hiddify references the missing panel local DNS tag');
    checkOutbound(!in_array($proxy['type'], ['selector', 'urltest', 'direct'], true), 'Hiddify received panel-only outbounds');
}

if (!empty($argv[2])) {
    if (!is_dir($argv[2])) mkdir($argv[2], 0777, true);
    foreach ($configs as $name => $config) {
        file_put_contents($argv[2] . '/' . $name . '.json', json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}
echo "PASS: modern/legacy sing-box numeric outbound ports, main headers and Hiddify DNS/TUN isolation\n";
