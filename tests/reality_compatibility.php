<?php

// Standalone regression check: php tests/reality_compatibility.php
require_once __DIR__ . '/../app/Utils/RealityCompatibility.php';

use App\Utils\RealityCompatibility;

function checkRealityCompatibility(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$default = RealityCompatibility::normalizeTlsSettings([]);
checkRealityCompatibility(
    $default['min_client_ver'] === '1.0.0',
    'Missing Hiddify-compatible REALITY minimum client version'
);

$custom = RealityCompatibility::normalizeTlsSettings(['min_client_ver' => '26.3.27']);
checkRealityCompatibility($custom['min_client_ver'] === '26.3.27', 'Overwrote an explicit minimum version');

$legacy = RealityCompatibility::normalizeTlsSettings(['minClientVer' => '1.8.2']);
checkRealityCompatibility($legacy['min_client_ver'] === '1.8.2', 'Did not normalize camelCase field');
checkRealityCompatibility(!isset($legacy['minClientVer']), 'Retained duplicate camelCase field');

$invalid = RealityCompatibility::normalizeTlsSettings(['min_client_ver' => '999.1']);
checkRealityCompatibility($invalid['min_client_ver'] === '1.0.0', 'Did not replace an invalid version');

echo "REALITY compatibility regression checks passed\n";
