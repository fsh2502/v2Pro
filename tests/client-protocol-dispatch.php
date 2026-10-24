<?php

// Standalone routing regression: php tests/client-protocol-dispatch.php [source-root]
namespace App\Http\Controllers { class Controller {} }
namespace Illuminate\Http {
    class Request
    {
        public $user;
        private $flag;
        private $agent;
        public function __construct($flag, $agent, $active = true)
        {
            $this->flag = $flag; $this->agent = $agent; $this->user = ['active' => $active];
        }
        public function input($name) { return $name === 'flag' ? $this->flag : null; }
        public function userAgent() { return $this->agent; }
    }
}
namespace App\Services {
    class UserService { public function isAvailable($user) { return $user['active']; } }
    class ServerService { public function getAvailableServers($user) { return [['name' => 'test']]; } }
}
namespace App\Protocols {
    class General
    {
        protected $servers;
        protected $options;
        public function __construct($user, $servers, $options = []) { $this->servers = $servers; $this->options = $options; }
        public function handle() { return ['renderer' => static::class, 'servers' => $this->servers, 'options' => $this->options]; }
    }
    class Happ extends General {}
    class Hiddify extends General {}
}
namespace App\Protocols\Singbox {
    class Singbox extends \App\Protocols\General {}
    class SingboxOld extends \App\Protocols\General {}
}
namespace {
    function config($key, $default = null) { return $default; }
    function app_path($path) { throw new RuntimeException('App/core recognition incorrectly iterated generic renderers'); }
    function checkClient($condition, $message) { if (!$condition) throw new RuntimeException($message); }
    $root = $argv[1] ?? dirname(__DIR__);
    require $root . '/app/Http/Controllers/V1/Client/ClientController.php';
    $controller = new App\Http\Controllers\V1\Client\ClientController();
    $happAgent = 'Happ/3.0 sing-box/1.12.0';
    foreach (['x-singbox', 'singbox', 'happ', '', null] as $flag) {
        $_SERVER['HTTP_USER_AGENT'] = $happAgent;
        $result = $controller->subscribe(new Illuminate\Http\Request($flag, $happAgent));
        checkClient($result['renderer'] === App\Protocols\Happ::class, 'Happ received a native sing-box configuration instead of Happ links');
    }
    $expired = $controller->subscribe(new Illuminate\Http\Request('singbox', $happAgent, false));
    checkClient($expired['renderer'] === App\Protocols\Happ::class && $expired['servers'] === [], 'Expired Happ subscription selected the wrong renderer');
    $hiddify = $controller->subscribe(new Illuminate\Http\Request('singbox', 'Hiddify/4.0 sing-box/1.13.0'));
    checkClient($hiddify['renderer'] === App\Protocols\Hiddify::class, 'Changed Hiddify recognition');
    foreach (['1.12.0' => App\Protocols\Singbox\Singbox::class, '1.11.0' => App\Protocols\Singbox\SingboxOld::class] as $version => $expected) {
        $result = $controller->subscribe(new Illuminate\Http\Request('singbox', 'sing-box/' . $version));
        checkClient($result['renderer'] === $expected, 'Changed native sing-box version dispatch');
    }
    $_SERVER['HTTP_USER_AGENT'] = '';
    $general = $controller->subscribe(new Illuminate\Http\Request(null, ''));
    checkClient($general['renderer'] === App\Protocols\General::class, 'Changed generic subscriptions');
    echo "PASS: Happ app/core precedence, expired Happ, Hiddify, native sing-box versions and generic subscriptions\n";
}
