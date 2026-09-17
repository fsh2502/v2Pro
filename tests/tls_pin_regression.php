<?php

// Standalone regression check: php tests/tls_pin_regression.php
require_once __DIR__ . '/../app/Services/NodeCertificateService.php';
require_once __DIR__ . '/../app/Utils/TlsPin.php';

use App\Utils\TlsPin;

function checkTlsPin(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$server = ['tls' => 1, 'host' => 'node.example.com'];
$unsafe = ['allowInsecure' => true, 'insecure' => 1, 'allow_insecure' => 1];
foreach (['CA certificate' => $server, 'pin disabled' => $server + ['tls_settings' => ['certificate_pinning' => 0]]] as $name => $node) {
    $uri = TlsPin::uri($unsafe + ['security' => 'tls'], $node);
    checkTlsPin(!isset($uri['allowInsecure'], $uri['insecure'], $uri['allow_insecure']), "$name retained unsafe URI flags");
    checkTlsPin(!array_intersect_key($unsafe, $uri), "$name retained an unsafe URI flag");
    checkTlsPin(!isset($uri['pcs']), "$name added an unavailable pin");
    $tls = TlsPin::xray(['allowInsecure' => true, 'serverName' => 'node.example.com'], $node);
    checkTlsPin(!isset($tls['allowInsecure']), "$name retained Xray allowInsecure");
    checkTlsPin($tls['serverName'] === 'node.example.com', 'Lost TLS server name');
}

$sha = str_repeat('ab', 32);
$server['tls_certificate_sha256'] = $sha;
$tls = TlsPin::xray(['allowInsecure' => true], $server);
checkTlsPin($tls['pinnedPeerCertSha256'] === $sha && $tls['verifyPeerCertByName'] === 'node.example.com', 'Missing Xray pin or peer name');
checkTlsPin(!isset($tls['allowInsecure']), 'Pinned TLS retained allowInsecure');
$uri = TlsPin::uri($unsafe, $server);
checkTlsPin($uri['pcs'] === $sha && $uri['vcn'] === 'node.example.com', 'Missing Happ URI pin');
checkTlsPin(!array_intersect_key($unsafe, $uri), 'Pinned URI retained unsafe flags');

// Native Hysteria verifies pinSHA256 separately from its CA verification.
$hy = TlsPin::uri(['insecure' => 1], $server, true);
checkTlsPin($hy['pinSHA256'] === $sha && $hy['insecure'] === 1, 'Changed native Hysteria pin verification behavior');
echo "TLS pin regression checks passed\n";
