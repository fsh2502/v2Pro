<?php

// Standalone: php tests/happ-domain-address.php [source-root]
// The optional root also runs the regression against an unmodified release.
namespace Illuminate\Support\Facades {
    class Cache
    {
        public static $values = [];
        public static $now = 0;
        public static $broken = false;

        public static function get($key)
        {
            if (self::$broken) throw new \RuntimeException('Cache unavailable');
            $entry = self::$values[$key] ?? null;
            return $entry && $entry['expires'] > self::$now ? $entry['value'] : null;
        }

        public static function put($key, $value, $seconds)
        {
            if (self::$broken) throw new \RuntimeException('Cache unavailable');
            self::$values[$key] = ['value' => $value, 'expires' => self::$now + $seconds];
        }
    }
}

namespace App\Services {
    function gethostbynamel($host)
    {
        $GLOBALS['dns_calls'][] = $host;
        return $GLOBALS['dns_a'][$host] ?? false;
    }

    function dns_get_record($host, $type)
    {
        return $GLOBALS['dns_aaaa'][$host] ?? false;
    }
}

namespace {
    use App\Protocols\Happ;
    use App\Services\NodeAddressResolver;
    use Illuminate\Support\Facades\Cache;

    function config($key, $default = null)
    {
        return $GLOBALS['test_config'][$key] ?? $default;
    }

    function checkHapp($condition, $message)
    {
        if (!$condition) throw new RuntimeException($message);
    }

    function parseHapp($uri)
    {
        $parts = parse_url(trim($uri));
        parse_str($parts['query'] ?? '', $params);
        return [$parts, $params];
    }

    $root = $argv[1] ?? dirname(__DIR__);
    require $root . '/app/Utils/Helper.php';
    require $root . '/app/Services/NodeCertificateService.php';
    require $root . '/app/Utils/TlsPin.php';
    require $root . '/app/Protocols/Happ.php';
    if (file_exists($root . '/app/Services/NodeAddressResolver.php')) {
        require $root . '/app/Services/NodeAddressResolver.php';
    }

    $GLOBALS['test_config'] = [];
    $GLOBALS['dns_calls'] = [];
    $GLOBALS['dns_a'] = ['node.example.com' => ['192.0.2.10']];
    $GLOBALS['dns_aaaa'] = [];
    $uuid = '00000000-0000-4000-8000-000000000001';
    $node = [
        'name' => 'REALITY domain', 'type' => 'v2node', 'protocol' => 'vless',
        'host' => 'node.example.com', 'port' => 443, 'network' => 'tcp',
        'network_settings' => [], 'tls' => 2, 'flow' => '',
        'tls_settings' => [
            'server_name' => 'www.softbank.jp', 'fingerprint' => 'safari',
            'public_key' => str_repeat('A', 43), 'short_id' => '0123abcd',
        ],
    ];

    $uri = Happ::buildVless($uuid, $node);
    [$parts, $params] = parseHapp($uri);
    checkHapp($parts['host'] === '192.0.2.10', 'Happ still needs client DNS to dial a REALITY domain');
    checkHapp($node['host'] === 'node.example.com', 'Changed the stored node hostname');
    checkHapp($params['sni'] === 'www.softbank.jp', 'REALITY SNI was replaced by the endpoint');
    checkHapp($params['security'] === 'reality' && $params['pbk'] === str_repeat('A', 43)
        && $params['sid'] === '0123abcd' && $params['fp'] === 'safari', 'Changed REALITY authentication');
    $literal = $node;
    $literal['host'] = '192.0.2.10';
    checkHapp(Happ::buildVless($uuid, $literal) === $uri, 'Resolved node differs from the working IP configuration');
    checkHapp(count($GLOBALS['dns_calls']) === 1, 'Looked up an IP literal');

    $GLOBALS['dns_a']['node.example.com'] = ['192.0.2.20'];
    checkHapp(parseHapp(Happ::buildVless($uuid, $node))[0]['host'] === '192.0.2.10', 'Did not reuse cached DNS');
    Cache::$now = 61;
    checkHapp(parseHapp(Happ::buildVless($uuid, $node))[0]['host'] === '192.0.2.20', 'DNS update was pinned indefinitely');

    $unresolved = $node;
    $unresolved['host'] = 'missing.example.com';
    checkHapp(parseHapp(Happ::buildVless($uuid, $unresolved))[0]['host'] === $unresolved['host'], 'DNS failure broke the subscription');
    $GLOBALS['dns_a']['missing.example.com'] = ['192.0.2.30'];
    checkHapp(parseHapp(Happ::buildVless($uuid, $unresolved))[0]['host'] === '192.0.2.30', 'DNS failure was cached');

    $ipv6 = $node;
    $ipv6['host'] = 'ipv6.example.com';
    $GLOBALS['dns_aaaa'][$ipv6['host']] = [['ipv6' => '2001:db8::10']];
    checkHapp(strpos(Happ::buildVless($uuid, $ipv6), '@[2001:db8::10]:443?') !== false, 'IPv6 dial address lacks URI brackets');

    Cache::$broken = true;
    $GLOBALS['dns_a']['node.example.com'] = ['192.0.2.40'];
    checkHapp(parseHapp(Happ::buildVless($uuid, $node))[0]['host'] === '192.0.2.40', 'Cache failure broke DNS resolution');
    Cache::$broken = false;

    $callsBefore = count($GLOBALS['dns_calls']);
    $tls = $node;
    $tls['tls'] = 1;
    $missingSni = $node;
    unset($missingSni['tls_settings']['server_name']);
    checkHapp(parseHapp(Happ::buildVless($uuid, $missingSni))[0]['host'] === $node['host'], 'Rewrote address without an explicit REALITY SNI');

    $GLOBALS['test_config']['v2board.happ_reality_resolve_enable'] = 0;
    checkHapp(parseHapp(Happ::buildVless($uuid, $node))[0]['host'] === $node['host'], 'Ignored resolver opt-out');
    $GLOBALS['test_config'] = ['v2board.app_resolve_address' => 'front.example.com'];
    checkHapp(parseHapp(Happ::buildVless($uuid, $node))[0]['host'] === $node['host'], 'Changed an explicit Happ fronting address');
    checkHapp(count($GLOBALS['dns_calls']) === $callsBefore, 'Unrelated configurations performed DNS lookups');
    $GLOBALS['test_config'] = [];

    Cache::$values = [];
    $GLOBALS['dns_a']['node.example.com'] = ['192.0.2.10'];
    $tls['tls_certificate_sha256'] = str_repeat('ab', 32);
    $fixtures = [
        'buildVless' => $tls,
        'buildTrojan' => $tls,
        'buildVmess' => $tls,
        'buildHysteria2' => $tls + ['obfs' => 'salamander', 'obfs_password' => 'test&secret'],
        'buildHysteria' => $tls + ['version' => 2, 'insecure' => 0, 'server_name' => 'www.softbank.jp'],
        'buildAnytls' => $tls,
        'buildShadowsocks' => array_replace($tls, ['tls' => 0, 'cipher' => 'aes-128-gcm']),
    ];
    foreach ($fixtures as $builder => $fixture) {
        $domainUri = Happ::$builder($uuid, $fixture);
        $ipFixture = $fixture;
        $ipFixture['host'] = '192.0.2.10';
        checkHapp($domainUri === Happ::$builder($uuid, $ipFixture), "$builder changed authentication or TLS parameters when resolving the domain");
        if ($builder === 'buildVmess') {
            $vmess = json_decode(base64_decode(substr(trim($domainUri), 8)), true);
            checkHapp($vmess['add'] === '192.0.2.10' && $vmess['sni'] === 'www.softbank.jp', 'VMess dial address/SNI mismatch');
        } else {
            [$endpoint, $query] = parseHapp($domainUri);
            checkHapp($endpoint['host'] === '192.0.2.10', "$builder still uses client DNS");
            if ($builder !== 'buildShadowsocks') {
                checkHapp($query['sni'] === 'www.softbank.jp', "$builder changed explicit SNI");
            }
        }
    }

    $implicitSni = $tls;
    unset($implicitSni['tls_settings']['server_name']);
    foreach (['buildVless', 'buildTrojan', 'buildVmess', 'buildHysteria2', 'buildAnytls'] as $builder) {
        $uri = Happ::$builder($uuid, $implicitSni);
        if ($builder === 'buildVmess') {
            $query = json_decode(base64_decode(substr(trim($uri), 8)), true);
            checkHapp($query['add'] === '192.0.2.10', 'VMess implicit SNI prevented resolution');
        } else {
            [$endpoint, $query] = parseHapp($uri);
            checkHapp($endpoint['host'] === '192.0.2.10', "$builder implicit SNI prevented resolution");
        }
        checkHapp($query['sni'] === 'node.example.com', "$builder did not preserve implicit hostname verification");
        if ($builder === 'buildHysteria2') {
            checkHapp($query['pinSHA256'] === str_repeat('ab', 32), 'Hysteria2 lost its certificate pin');
        } else {
            checkHapp(($query['pcn'] ?? null) === 'node.example.com' || ($query['vcn'] ?? null) === 'node.example.com', "$builder changed certificate pin verification name");
        }
    }

    foreach (['ws', 'httpupgrade', 'xhttp'] as $network) {
        $transport = $implicitSni;
        $transport['network'] = $network;
        $transport['network_settings'] = ['path' => '/proxy', 'host' => ''];
        [$endpoint, $query] = parseHapp(Happ::buildVless($uuid, $transport));
        checkHapp($endpoint['host'] === '192.0.2.10' && $query['sni'] === 'node.example.com'
            && $query['host'] === 'node.example.com' && $query['path'] === '/proxy', "$network lost its implicit HTTP Host or TLS SNI");
        $transport['network_settings']['host'] = 'http.example.com';
        if ($network === 'ws') $transport['network_settings']['headers']['Host'] = 'http.example.com';
        checkHapp(parseHapp(Happ::buildVless($uuid, $transport))[1]['host'] === 'http.example.com', "$network changed an explicit HTTP Host");
    }

    $trojanWs = $implicitSni;
    $trojanWs['network'] = 'ws';
    $trojanWs['network_settings'] = ['path' => '/trojan'];
    [$endpoint, $query] = parseHapp(Happ::buildTrojan($uuid, $trojanWs));
    checkHapp($endpoint['host'] === '192.0.2.10' && $query['sni'] === 'node.example.com'
        && $query['host'] === 'node.example.com' && $query['path'] === '/trojan'
        && $query['pcs'] === str_repeat('ab', 32), 'Trojan TLS/WebSocket lost its hostname, path or certificate pin');
    $trojanGrpc = $tls;
    $trojanGrpc['network'] = 'grpc';
    $trojanGrpc['network_settings'] = ['serviceName' => 'trojan-service'];
    [$endpoint, $query] = parseHapp(Happ::buildTrojan($uuid, $trojanGrpc));
    checkHapp($endpoint['host'] === '192.0.2.10' && $query['serviceName'] === 'trojan-service'
        && $query['sni'] === 'www.softbank.jp', 'Trojan gRPC service or SNI changed');

    $noSni = $implicitSni + ['disable_sni' => 1];
    checkHapp(parseHapp(Happ::buildTrojan($uuid, $noSni))[0]['host'] === 'node.example.com', 'Overrode deliberate no-SNI configuration');
    $badDnsTls = $implicitSni;
    $badDnsTls['host'] = 'unresolved-tls.example.com';
    checkHapp(parseHapp(Happ::buildTrojan($uuid, $badDnsTls))[0]['host'] === $badDnsTls['host'], 'TLS DNS failure dropped the node');

    $plain = $node;
    $plain['tls'] = 0;
    checkHapp(parseHapp(Happ::buildVless($uuid, $plain))[0]['host'] === '192.0.2.10', 'Plain VLESS still uses client DNS');
    $plainVmess = json_decode(base64_decode(substr(trim(Happ::buildVmess($uuid, $plain)), 8)), true);
    checkHapp($plainVmess['add'] === '192.0.2.10' && $plainVmess['tls'] === '' && !isset($plainVmess['sni']), 'Plain VMess gained TLS or retained client DNS');

    $legacyTls = $implicitSni;
    $legacyTls['tlsSettings'] = $legacyTls['tls_settings'];
    $legacyTls['tlsSettings']['serverName'] = 'legacy.example.com';
    unset($legacyTls['tls_settings']);
    checkHapp(parseHapp(Happ::buildTrojan($uuid, $legacyTls))[1]['sni'] === 'legacy.example.com', 'Lost legacy TLS settings during resolution');

    $GLOBALS['test_config'] = ['v2board.happ_domain_resolve_enable' => 0];
    foreach ($fixtures as $builder => $fixture) {
        $uri = Happ::$builder($uuid, $fixture);
        $host = $builder === 'buildVmess'
            ? json_decode(base64_decode(substr(trim($uri), 8)), true)['add']
            : parseHapp($uri)[0]['host'];
        checkHapp($host === 'node.example.com', "$builder ignored the global opt-out");
    }
    $GLOBALS['test_config'] = ['v2board.happ_reality_resolve_enable' => 0];
    checkHapp(parseHapp(Happ::buildTrojan($uuid, $tls))[0]['host'] === '192.0.2.10', 'Legacy REALITY opt-out unexpectedly disabled Trojan resolution');
    $GLOBALS['test_config'] = ['v2board.app_resolve_address' => 'front.example.com'];
    checkHapp(parseHapp(Happ::buildTrojan($uuid, $tls))[0]['host'] === 'node.example.com', 'Changed explicit Trojan fronting');
    $GLOBALS['test_config'] = [];

    // The generic subscription must still carry the administrator's hostname.
    $general = App\Utils\Helper::buildVlessUri($uuid, $node);
    checkHapp(parseHapp($general)[0]['host'] === $node['host'], 'Changed other clients');

    echo "PASS: Happ REALITY/TLS/SS domain resolution, SNI, certificate pins, HTTP Host, IPv6, DNS/cache failures and opt-outs\n";
}
