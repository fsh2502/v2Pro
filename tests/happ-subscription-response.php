<?php

// Standalone: php tests/happ-subscription-response.php [source-root]
// Deliberately do not load SubscriptionNameService: upstream main lacks it.
$root = $argv[1] ?? dirname(__DIR__);
require $root . '/app/Utils/Helper.php';
require $root . '/app/Utils/TlsPin.php';
require $root . '/app/Protocols/Happ.php';
if (file_exists($root . '/app/Services/NodeAddressResolver.php')) {
    require $root . '/app/Services/NodeAddressResolver.php';
}

function config($key, $default = null)
{
    return $GLOBALS['happ_config'][$key] ?? $default;
}

class HappTestResponse
{
    public $body;
    public $status;
    public $headers = [];

    public function __construct($body, $status)
    {
        $this->body = $body;
        $this->status = $status;
    }

    public function header($name, $value)
    {
        $this->headers[strtolower($name)] = $value;
        return $this;
    }
}

function response($body, $status = 200)
{
    return new HappTestResponse($body, $status);
}

function checkHappResponse($condition, $message)
{
    if (!$condition) throw new RuntimeException($message);
}

$GLOBALS['happ_config'] = ['v2board.app_name' => 'Panel VPN'];
$user = [
    'id' => 1, 'uuid' => '00000000-0000-4000-8000-000000000001',
    'u' => 0, 'd' => 0, 'transfer_enable' => 1073741824, 'expired_at' => 1798761600,
];
$node = [
    'type' => 'v2node', 'protocol' => 'vless', 'name' => 'Test node',
    'host' => '192.0.2.10', 'port' => 443, 'tls' => 2, 'network' => 'tcp',
    'network_settings' => [], 'flow' => '',
    'tls_settings' => ['server_name' => 'example.com', 'public_key' => str_repeat('A', 43), 'short_id' => '0123abcd'],
];

checkHappResponse(!class_exists('App\\Services\\SubscriptionNameService'), 'Main compatibility test unexpectedly loaded the optional service');
$response = (new App\Protocols\Happ($user, [$node]))->handle();
checkHappResponse($response->status === 200, 'Main subscription did not return HTTP 200');
checkHappResponse($response->headers['profile-title'] === 'Panel VPN', 'Main did not fall back to the configured app name');
checkHappResponse(strpos($response->body, 'vless://' . $user['uuid'] . '@192.0.2.10:443?') === 0, 'Main subscription lost its node');
checkHappResponse(isset($response->headers['subscription-userinfo']), 'Missing subscription traffic header');
$expired = (new App\Protocols\Happ($user, []))->handle();
checkHappResponse($expired->status === 200 && strpos($expired->body, '@127.0.0.1:443?') !== false, 'Expired subscription failed on main');

// Install an optional naming service afterwards, as in the staff/Max build.
class HappTestNamingService
{
    public static $name = 'Staff VPN';

    public static function forUser($user)
    {
        return self::$name;
    }
}
class_alias(HappTestNamingService::class, 'App\\Services\\SubscriptionNameService');
$personalized = (new App\Protocols\Happ($user, [$node]))->handle();
checkHappResponse($personalized->headers['profile-title'] === 'Staff VPN', 'Lost existing staff subscription names');
HappTestNamingService::$name = 'Updated Staff VPN';
$updated = (new App\Protocols\Happ($user, [$node]))->handle();
checkHappResponse($updated->headers['profile-title'] === 'Updated Staff VPN', 'Subscription update retained a stale profile name');

echo "PASS: complete Happ subscription response without optional naming service, expired response and existing staff names\n";
