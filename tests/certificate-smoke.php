<?php
// Standalone regression checks: php tests/certificate-smoke.php
// Uses an in-memory cache double; does not require a database or vendor/.
namespace Illuminate\Support\Facades {
    class Cache {
        public static $values = [];
        public static function get($key) { return self::$values[$key] ?? null; }
        public static function put($key, $value, $ttl) { self::$values[$key] = $value; }
        public static function forget($key) { unset(self::$values[$key]); }
    }
}
namespace {
    spl_autoload_register(function ($class) {
        if (strpos($class, 'App\\') === 0) require __DIR__ . '/../app/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    });
    function abort($status, $message) { throw new \RuntimeException($message, $status); }
    function config($key, $default = null) { return $default; }
    function check($condition, $message) {
        if (!$condition) throw new \RuntimeException($message);
        $GLOBALS['checks']++;
    }
    function rejects($callback, $code) {
        try { $callback(); } catch (\RuntimeException $e) { check($e->getCode() === $code, 'Unexpected rejection'); return; }
        throw new \RuntimeException('Expected rejection');
    }
    set_error_handler(function ($severity, $message, $file, $line) { throw new \ErrorException($message, 0, $severity, $file, $line); });
    $checks = 0;
    $service = new \App\Services\NodeCertificateService();
    $sha = str_repeat('ab', 32);
    $spki = base64_encode(str_repeat("\xff", 32));
    check($service->normalizeCertificateSha256('SHA256 Fingerprint=' . strtoupper(implode(':', str_split($sha, 2)))) === $sha, 'OpenSSL format');
    check($service->normalizeCertificateSha256($sha . '!') === null, 'Reject corrupt certificate pin');
    check($service->normalizePublicKeySha256('sha256/' . rtrim(strtr($spki, '+/', '-_'), '=')) === $spki, 'URL-safe SPKI');
    check($service->normalizePublicKeySha256($sha) === null, 'Certificate hex is not SPKI');
    $node = [
        'id' => 7, 'created_at' => 100, 'tls' => 1, 'type' => 'v2node', 'protocol' => 'vless',
        'server_port' => 443, 'host' => 'node.example.com', 'port' => 443, 'name' => 'Test TLS',
        'network' => 'tcp', 'network_settings' => [], 'networkSettings' => [], 'flow' => '',
        'tls_settings' => ['server_name' => 'node.example.com', 'cert_mode' => 'self', 'allow_insecure' => 1, 'fingerprint' => 'chrome'],
    ];
    $report = ['revision' => $service->revision($node), 'tls_enabled' => true,
        'tls_certificate_sha256' => $sha, 'tls_public_key_sha256' => $spki,
        'tls_not_after' => time() + 86400, 'tls_issuer' => 'CN=Test'];
    $service->report($node, $report);
    check($service->snapshot($node)['sha256'] === $sha, 'Store authenticated report');
    $server = $service->attach($node, $node);
    $otherNode = array_replace($node, ['id' => 8]);
    check($service->snapshot($otherNode) === [], 'Logical nodes have separate snapshots');
    $changed = $node;
    $changed['tls_settings']['cert_file'] = '/etc/v2node/new.cer';
    check($service->snapshot($changed) === [], 'Configuration changes hide stale pins');
    $proxyTerminated = $node;
    $proxyTerminated['tls_settings']['terminate_tls_at_proxy'] = '1';
    check($service->snapshot($proxyTerminated) === [], 'Proxy TLS mode changes certificate revision');
    rejects(function () use ($service, $changed, $report) { $service->report($changed, $report); }, 409);
    rejects(function () use ($service, $node, $report) { $service->report($node, array_replace($report, ['tls_public_key_sha256' => 'invalid'])); }, 422);
    check($service->snapshot($node)['sha256'] === $sha, 'Bad report retains last good pin');
    $uuid = '11111111-1111-4111-8111-111111111111';
    parse_str(parse_url(trim(\App\Utils\Helper::buildUri($uuid, $server)), PHP_URL_QUERY), $query);
    check($query['pcs'] === $sha && $query['vcn'] === 'node.example.com' && !isset($query['insecure']), 'VLESS subscription pin');
    $vmess = json_decode(base64_decode(substr(trim(\App\Utils\Helper::buildVmessUri($uuid, $server)), 8)), true);
    check($vmess['pcs'] === $sha && !isset($vmess['allowInsecure']), 'VMess JSON pin');
    $incy = new \App\Protocols\Incy(['uuid' => $uuid], []);
    $incyStreamMethod = new \ReflectionMethod(\App\Protocols\Incy::class, 'buildStreamSettings');
    $incyStreamMethod->setAccessible(true);
    $incyStream = $incyStreamMethod->invoke($incy, $server, true);
    check($incyStream['tlsSettings']['pinnedPeerCertSha256'] === $sha, 'Incy Xray certificate pin');
    check($incyStream['tlsSettings']['verifyPeerCertByName'] === 'node.example.com', 'Incy Xray certificate name');
    check(!isset($incyStream['tlsSettings']['allowInsecure']), 'Incy pin replaces removed allowInsecure');
    $incyWssServer = $server;
    $incyWssServer['network'] = 'ws';
    $incyWssServer['network_settings'] = [
        'path' => '/node-25',
        'headers' => ['Host' => 'node.example.com'],
    ];
    $incyTrojanMethod = new \ReflectionMethod(\App\Protocols\Incy::class, 'buildTrojanOutbound');
    $incyTrojanMethod->setAccessible(true);
    $incyTrojan = $incyTrojanMethod->invoke($incy, $incyWssServer);
    check($incyTrojan['streamSettings']['security'] === 'tls', 'Incy Trojan WSS enables TLS');
    check($incyTrojan['streamSettings']['wsSettings']['path'] === '/node-25', 'Incy Trojan WSS path');
    check($incyTrojan['streamSettings']['wsSettings']['headers']['Host'] === 'node.example.com', 'Incy Trojan WSS host');
    check($incyTrojan['streamSettings']['tlsSettings']['pinnedPeerCertSha256'] === $sha, 'Incy Trojan WSS certificate pin');
    parse_str(parse_url(trim(\App\Utils\Helper::buildHysteria2Uri($uuid, $server)), PHP_URL_QUERY), $query);
    check($query['pinSHA256'] === $sha && $query['insecure'] === '1', 'HY2 preserves self-signed pin semantics');
    parse_str(parse_url(trim(\App\Protocols\Happ::buildHysteria2($uuid, $server)), PHP_URL_QUERY), $query);
    check($query['pinSHA256'] === $sha, 'Happ HY2 pin');
    foreach (['ClashMeta', 'ClashVerge', 'ClashNyanpasu', 'Stash'] as $renderer) {
        $class = 'App\\Protocols\\' . $renderer;
        $proxy = $class::buildVless($uuid, $server);
        $field = $renderer === 'Stash' ? 'server-cert-fingerprint' : 'fingerprint';
        check($proxy[$field] === $sha && $proxy['skip-cert-verify'] === false, $renderer . ' certificate pin');
        check($proxy['client-fingerprint'] === 'chrome', $renderer . ' preserves ClientHello fingerprint');
    }
    $method = new \ReflectionMethod(\App\Protocols\Singbox\Singbox::class, 'buildProxies');
    $method->setAccessible(true);
    foreach (['1.12.9' => false, '1.13.0' => true, '1.14.0' => true, '' => false] as $version => $supported) {
        $renderer = new \App\Protocols\Singbox\Singbox(['uuid' => $uuid], [$server], ['version' => $version]);
        $proxy = $method->invoke($renderer)[0];
        check(isset($proxy['tls']['certificate_public_key_sha256']) === $supported, 'sing-box version ' . $version);
        if ($supported) check($proxy['tls']['certificate_public_key_sha256'] === [$spki], 'sing-box uses SPKI, not certificate');
    }
    $reality = array_replace($server, ['tls' => 2]);
    check(\App\Utils\TlsPin::resolve($reality)['certificate'] === '', 'No REALITY pin');
    check(\App\Utils\TlsPin::resolve(array_replace($server, ['tls' => 0]))['certificate'] === '', 'No plaintext pin');
    $disabled = $server;
    $disabled['tls_settings']['certificate_pinning'] = '0';
    check(\App\Utils\TlsPin::resolve($disabled)['certificate'] === '', 'CDN opt-out');
    $renewed = array_replace($report, ['tls_certificate_sha256' => str_repeat('cd', 32)]);
    $service->report($node, $renewed);
    check($service->snapshot($node)['sha256'] === $renewed['tls_certificate_sha256'], 'Renewal replaces pin');
    $service->report($node, array_replace($report, ['tls_enabled' => false]));
    check($service->snapshot($node) === [], 'TLS disabled clears snapshot');
    echo "Certificate regression checks passed: $checks\n";
}
