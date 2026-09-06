<?php

namespace App\Utils;

use App\Services\NodeCertificateService;

class TlsPin
{
    public static function resolve(array $server): array
    {
        $empty = ['certificate' => '', 'public_key' => '', 'name' => ''];
        $settings = $server['tls_settings'] ?? ($server['tlsSettings'] ?? []);
        if ((int)($server['tls'] ?? 0) !== 1
            || (isset($settings['certificate_pinning']) && !(int)$settings['certificate_pinning'])) {
            return $empty;
        }
        $normalizer = new NodeCertificateService();
        return [
            'certificate' => $normalizer->normalizeCertificateSha256($server['tls_certificate_sha256'] ?? null) ?? '',
            'public_key' => $normalizer->normalizePublicKeySha256($server['tls_public_key_sha256'] ?? null) ?? '',
            'name' => $settings['verifyPeerCertByName'] ?? ($settings['server_name']
                ?? ($settings['serverName'] ?? ($server['server_name'] ?? $server['host'] ?? ''))),
        ];
    }

    public static function uri(array $config, array $server, bool $hysteria = false): array
    {
        $pin = self::resolve($server);
        if ($pin['certificate'] === '') return $config;
        if ($hysteria) {
            // Hysteria verifies the pin separately; keep its existing insecure
            // setting so self-signed certificates can reach the pin check.
            $config['pinSHA256'] = $pin['certificate'];
        } else {
            $config['pcs'] = $pin['certificate'];
            $config['vcn'] = $pin['name'];
            unset($config['insecure'], $config['allowInsecure'], $config['allow_insecure']);
        }
        return $config;
    }

    public static function mihomo(array $proxy, array $server, bool $stash = false): array
    {
        $pin = self::resolve($server);
        if ($pin['certificate'] !== '' && in_array($proxy['type'] ?? '', ['vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls'], true)) {
            $proxy[$stash ? 'server-cert-fingerprint' : 'fingerprint'] = $pin['certificate'];
            $proxy['skip-cert-verify'] = false;
            if (!$stash && $pin['name'] !== '') $proxy['name-cert-verify'] = $pin['name'];
        }
        return $proxy;
    }

    public static function singbox(array $proxy, array $server, ?string $version): array
    {
        $pin = self::resolve($server);
        if ($version && version_compare($version, '1.13.0', '>=')
            && $pin['public_key'] !== '' && !empty($proxy['tls']['enabled'])
            && empty($proxy['tls']['reality']['enabled'])) {
            $proxy['tls']['certificate_public_key_sha256'] = [$pin['public_key']];
            $proxy['tls']['insecure'] = false;
        }
        return $proxy;
    }
}
