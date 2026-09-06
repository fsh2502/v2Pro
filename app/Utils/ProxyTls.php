<?php

namespace App\Utils;

class ProxyTls
{
    // Nginx selects a certificate by SNI, then an HTTP server by Host.
    // Both must describe the same public endpoint when pinning its certificate.
    public static function normalize(array $params): array
    {
        $tls = $params['tls_settings'] ?? [];
        if (!filter_var($tls['terminate_tls_at_proxy'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return $params;
        }
        if ((int)$params['tls'] !== 1 || $params['network'] !== 'ws'
            || !in_array($params['protocol'], ['vmess', 'vless', 'trojan'], true)) {
            abort(422, 'TLS tại Nginx yêu cầu TLS thường và WebSocket với VMess/VLESS/Trojan.');
        }
        $sni = is_string($tls['server_name'] ?? null) ? strtolower(trim($tls['server_name'])) : '';
        if ($sni === '' || !filter_var($sni, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)
            || filter_var($sni, FILTER_VALIDATE_IP)) {
            abort(422, 'Nhập Server Name (SNI) đúng domain kết nối node trong Nginx.');
        }
        if ((int)($params['disable_sni'] ?? 0) !== 0) {
            abort(422, 'Tắt Disable SNI khi dùng nhiều domain TLS tại Nginx.');
        }
        $network = $params['network_settings'] ?? [];
        if (isset($network['headers']) && !is_array($network['headers'])) {
            abort(422, 'WebSocket headers phải là object chứa Host.');
        }
        if (filter_var($network['acceptProxyProtocol'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            abort(422, 'Tắt acceptProxyProtocol: Nginx HTTP WebSocket gửi HTTP, không gửi PROXY protocol.');
        }
        $wsHost = $network['headers']['Host'] ?? ($network['host'] ?? '');
        if (!is_string($wsHost) || ($wsHost !== '' && strtolower($wsHost) !== $sni)) {
            abort(422, 'WebSocket Host phải trùng Server Name (SNI) của domain node.');
        }
        if (!is_string($tls['cert_file'] ?? null) || trim($tls['cert_file']) === ''
            || !is_string($tls['key_file'] ?? null) || trim($tls['key_file']) === '') {
            abort(422, 'Nhập Cert File và Key File đúng cặp chứng chỉ của domain trong Nginx.');
        }
        $tls['server_name'] = $sni;
        $network['host'] = $sni;
        $network['headers'] = $network['headers'] ?? [];
        $network['headers']['Host'] = $sni;
        $params['tls_settings'] = $tls;
        $params['network_settings'] = $network;
        return $params;
    }
}
