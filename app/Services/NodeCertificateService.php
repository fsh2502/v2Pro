<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class NodeCertificateService
{
    public function normalizeCertificateSha256($value): ?string
    {
        if (!is_string($value)) return null;
        $value = preg_replace('/^\s*sha-?256\s+fingerprint\s*=\s*/i', '', $value);
        $value = strtolower(preg_replace('/[:\s]/', '', $value));
        return preg_match('/\A[a-f0-9]{64}\z/', $value) ? $value : null;
    }

    public function normalizePublicKeySha256($value): ?string
    {
        if (!is_string($value)) return null;
        $value = preg_replace('/^sha256\//i', '', trim($value));
        $value = strtr(preg_replace('/\s+/', '', $value), '-_', '+/');
        $decoded = base64_decode($value, true);
        return $decoded !== false && strlen($decoded) === 32 ? base64_encode($decoded) : null;
    }

    // Bind a report to the runtime configuration that produced it. A delayed
    // report from before a TLS/port/certificate change must not restore old pins.
    public function revision($node): string
    {
        $tls = $node['tls_settings'] ?? [];
        return hash('sha256', json_encode([
            $node['id'], $node['created_at'], (int)$node['tls'],
            $node['protocol'], (int)$node['server_port'],
            $tls['cert_mode'] ?? '', $tls['cert_file'] ?? '',
            $tls['key_file'] ?? '', $tls['server_name'] ?? ''
        ]));
    }

    public function snapshot($node): array
    {
        if ((int)$node['tls'] !== 1) return [];
        $value = Cache::get('SERVER_V2NODE_CERT_' . $node['id']);
        return is_array($value) && ($value['revision'] ?? '') === $this->revision($node)
            ? $value : [];
    }

    public function report($node, array $data): void
    {
        if (!hash_equals($this->revision($node), $data['revision'])) {
            abort(409, 'Node configuration changed; pull configuration before reporting the certificate.');
        }
        $key = 'SERVER_V2NODE_CERT_' . $node['id'];
        if ((int)$node['tls'] !== 1 || !$data['tls_enabled']) {
            Cache::forget($key);
            return;
        }
        $sha = $this->normalizeCertificateSha256($data['tls_certificate_sha256'] ?? null);
        $spki = $this->normalizePublicKeySha256($data['tls_public_key_sha256'] ?? null);
        // A TLS read error leaves the last valid snapshot untouched.
        if (!$sha || !$spki) abort(422, 'Both certificate SHA256 and public key SHA256 must be valid.');
        Cache::put($key, [
            'sha256' => $sha,
            'public_key_sha256' => $spki,
            'not_after' => $data['tls_not_after'] ?? null,
            'issuer' => $data['tls_issuer'] ?? null,
            'updated_at' => time(),
            'revision' => $data['revision'],
        ], 2592000);
    }

    public function attach(array $server, $runtime): array
    {
        if ((int)($server['tls'] ?? 0) !== 1) return $server;
        $cert = $this->snapshot($runtime);
        if ($cert) {
            $server['tls_certificate_sha256'] = $cert['sha256'];
            $server['tls_public_key_sha256'] = $cert['public_key_sha256'];
        }
        return $server;
    }
}
