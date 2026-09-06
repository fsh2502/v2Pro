<?php
require __DIR__ . '/../app/Utils/ProxyTls.php';
function abort($code, $message) { throw new RuntimeException($message, $code); }
function check($ok, $message) { if (!$ok) throw new RuntimeException($message); }
$base = [
    'tls' => 1, 'protocol' => 'trojan', 'network' => 'ws', 'disable_sni' => 0,
    'tls_settings' => ['terminate_tls_at_proxy' => '1', 'server_name' => 'node-b.example.com',
        'cert_file' => '/etc/v2node/proxy-certs/node-b.example.com.cer',
        'key_file' => '/etc/v2node/proxy-certs/node-b.example.com.key'],
    'network_settings' => ['path' => '/panel-b'],
];
$normalized = App\Utils\ProxyTls::normalize($base);
check($normalized['network_settings']['host'] === 'node-b.example.com', 'Missing WS host filled from SNI');
check($normalized['network_settings']['headers']['Host'] === 'node-b.example.com', 'URI exporter header filled from SNI');
check($normalized['network_settings']['path'] === '/panel-b', 'Path retained');
foreach ([
    ['tls_settings', 'server_name', ''],
    ['tls_settings', 'server_name', '1.2.3.4'],
    ['tls_settings', 'cert_file', ''],
    ['tls_settings', 'key_file', ''],
    ['network_settings', 'host', 'node-a.example.com'],
    ['network_settings', 'headers', ['Host' => 'node-a.example.com']],
    ['network_settings', 'acceptProxyProtocol', true],
    ['network_settings', 'acceptProxyProtocol', 'true'],
    [null, 'disable_sni', 1],
    [null, 'network', 'tcp'],
    [null, 'tls', 0],
    [null, 'protocol', 'tuic'],
] as [$group, $key, $value]) {
    $bad = $base;
    if ($group === null) $bad[$key] = $value;
    else $bad[$group][$key] = $value;
    try { App\Utils\ProxyTls::normalize($bad); throw new LogicException('Accepted invalid ' . $key); }
    catch (RuntimeException $error) { check($error->getCode() === 422, 'Expected validation error'); }
}
$direct = $base;
$direct['tls_settings']['terminate_tls_at_proxy'] = '0';
$direct['tls_settings']['server_name'] = '';
check(App\Utils\ProxyTls::normalize($direct) === $direct, 'Ordinary TLS settings retained');
echo "PASS: SNI/WS Host normalization, invalid proxy TLS settings rejected, direct TLS retained\n";
