<?php

namespace App\Protocols;

use App\Utils\Helper;

class Happ
{
    public $flag = 'happ';
    private $servers;
    private $user;

    public function __construct($user, $servers)
    {
        $this->user = $user;
        $this->servers = $servers;
    }

    public function handle()
    {
        $user = $this->user;
        $servers = $this->servers;
        $body = '';
        $headers = $this->buildHeaders($user);
        $isExpired = isset($user['expired_at']) && $user['expired_at'] !== null && (int) $user['expired_at'] <= time();

        foreach ($servers as $server) {
            if (($server['type'] ?? null) === 'v2node') {
                $server['type'] = $server['protocol'];
            }
            if ($isExpired) {
                $server['happ_server_description'] = 'Gói đã hết hạn';
            }

            switch ($server['type']) {
                case 'vmess':
                    $body .= self::buildVmess($user['uuid'], $server);
                    break;
                case 'vless':
                    $body .= self::buildVless($user['uuid'], $server);
                    break;
                case 'trojan':
                    $body .= self::buildTrojan($user['uuid'], $server);
                    break;
                case 'shadowsocks':
                    $body .= self::buildShadowsocks($user['uuid'], $server);
                    break;
                case 'hysteria':
                    $body .= self::buildHysteria($user['uuid'], $server);
                    break;
                case 'hysteria2':
                    $body .= self::buildHysteria2($user['uuid'], $server);
                    break;
                case 'tuic':
                    $body .= self::buildTuic($user['uuid'], $server);
                    break;
                case 'anytls':
                    $body .= self::buildAnytls($user['uuid'], $server);
                    break;
            }
        }

        if (config('v2board.happ_encryption_enable', 0)) {
            $key = substr(md5($user['uuid']), 0, 16);
            $iv = substr(md5(config('app.key')), 0, 16);
            $body = openssl_encrypt($body, 'aes-128-cbc', $key, 0, $iv);
            $headers['encryption'] = 'aes-128-cbc';
            $headers['encryption-key'] = $key;
            $headers['encryption-iv'] = $iv;
        }

        return $this->buildResponse($body, $headers);
    }

    private function buildHeaders($user)
    {
        $appName = $this->limitText(config('v2board.app_name', 'V2Board'), 25);
        $siteUrl = config('v2board.app_site_url') ?: config('v2board.app_url', '');
        $supportUrl = config('v2board.app_support_url') ?: $siteUrl;
        $expireAt = (int) ($user['expired_at'] ?? 0);
        $headers = [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Disposition' => "attachment; filename*=UTF-8''" . rawurlencode($appName),
            'profile-title' => $appName,
            'profile-update-interval' => '2',
            'subscription-userinfo' => "upload={$user['u']}; download={$user['d']}; total={$user['transfer_enable']}; expire={$expireAt}",
        ];

        $this->addHeader($headers, 'profile-web-page-url', $siteUrl);
        $this->addHeader($headers, 'support-url', $supportUrl);
        $headers['routing-enable'] = $this->boolValue(config('v2board.app_routing_enable', 1));

        $announce = config('v2board.app_announce', '');
        if ($announce !== '') {
            $headers['announce'] = 'base64:' . base64_encode($announce);
        }

        $providerId = trim((string) config('v2board.app_provider_id', ''));
        if ($providerId === '') {
            return $headers;
        }

        $headers['providerid'] = $providerId;
        $this->addHeader($headers, 'fallback-url', config('v2board.app_fallback_url'));

        if (config('v2board.app_sub_info_text', null) !== null) {
            $headers['sub-info-color'] = config('v2board.app_sub_info_color', 'blue');
            $headers['sub-info-text'] = $this->limitText((string) config('v2board.app_sub_info_text', ''), 200);
            $this->addHeader($headers, 'sub-info-button-text', $this->limitText((string) config('v2board.app_sub_info_button_text', ''), 25));
            $this->addHeader($headers, 'sub-info-button-link', config('v2board.app_sub_info_button_link'));
        }

        $headers['sub-expire'] = $this->boolValue(config('v2board.app_sub_expire_notify', 0));
        $this->addHeader($headers, 'sub-expire-button-link', config('v2board.app_sub_expire_button_link'));

        $headers['notification-subs-expire'] = $this->boolValue(config('v2board.app_notification_expire', 0));
        $headers['hide-settings'] = $this->boolValue(config('v2board.app_hide_settings', config('v2board.happ_hide_settings', 0)));
        $headers['subscription-autoconnect'] = $this->boolValue(config('v2board.app_auto_connect', 0));
        $this->addHeader($headers, 'subscription-autoconnect-type', config('v2board.app_auto_connect_type'));
        $headers['subscription-ping-onopen-enabled'] = $this->boolValue(config('v2board.app_auto_ping', 0));
        $headers['subscription-auto-update-enable'] = $this->boolValue(config('v2board.app_auto_update', 0));
        $headers['subscription-auto-update-open-enable'] = $this->boolValue(config('v2board.app_auto_update_on_open', 0));

        $headers['fragmentation-enable'] = $this->boolValue(config('v2board.app_fragment_enable', 0));
        $this->addHeader($headers, 'fragmentation-packets', config('v2board.app_fragment_packets'));
        $this->addHeader($headers, 'fragmentation-length', config('v2board.app_fragment_length'));
        $this->addHeader($headers, 'fragmentation-interval', config('v2board.app_fragment_interval'));
        $headers['noises-enable'] = $this->boolValue(config('v2board.app_noises_enable', 0));
        $this->addHeader($headers, 'noises-type', config('v2board.app_noises_type'));
        $this->addHeader($headers, 'noises-packet', config('v2board.app_noises_packet'));
        $this->addHeader($headers, 'noises-delay', config('v2board.app_noises_delay'));

        $this->addHeader($headers, 'ping-type', config('v2board.app_ping_type'));
        $this->addHeader($headers, 'check-url-via-proxy', config('v2board.app_ping_check_url'));
        $this->addHeader($headers, 'ping-result', config('v2board.app_ping_result'));
        $this->addHeader($headers, 'change-user-agent', config('v2board.app_change_user_agent'));
        $headers['app-auto-start'] = $this->boolValue(config('v2board.app_auto_start', 0));
        $headers['subscription-always-hwid-enable'] = $this->boolValue(config('v2board.app_hwid_force', 0));
        $headers['server-address-resolve-enable'] = $this->boolValue(config('v2board.app_server_resolve_enable', 0));
        $this->addHeader($headers, 'server-address-resolve-dns-domain', config('v2board.app_server_resolve_dns_domain'));
        $this->addHeader($headers, 'server-address-resolve-dns-ip', config('v2board.app_server_resolve_dns_ip'));
        $headers['sniffing-enable'] = $this->boolValue(config('v2board.app_sniffing_enable', 1));
        $headers['subscriptions-collapse'] = $this->boolValue(config('v2board.app_subscriptions_collapse', 1));
        $headers['no-limit-enabled'] = $this->boolValue(config('v2board.app_no_limit_enabled', 0));
        $this->addHeader($headers, 'color-profile', config('v2board.app_color_profile'));

        if ((int) config('v2board.app_tun_enable', 0) === 1) {
            $headers['tun-enable'] = '1';
        }
        if ((int) config('v2board.app_proxy_enable', 0) === 1) {
            $headers['proxy-enable'] = '1';
        }

        $this->addHeader($headers, 'tun-mode', config('v2board.app_tun_mode'));
        $this->addHeader($headers, 'tun-type', config('v2board.app_tun_type'));
        $this->addHeader($headers, 'per-app-proxy-mode', config('v2board.app_per_app_proxy_mode'));
        $this->addHeader($headers, 'per-app-proxy-list', config('v2board.app_per_app_proxy_list'));
        $headers['mux-enable'] = $this->boolValue(config('v2board.app_mux_enable', 0));
        $this->addHeader($headers, 'mux-tcp-connections', config('v2board.app_mux_tcp_connections'));
        $this->addHeader($headers, 'mux-xudp-connections', config('v2board.app_mux_xudp_connections'));
        $this->addHeader($headers, 'mux-quic', config('v2board.app_mux_quic'));
        $this->addHeader($headers, 'exclude-routes', config('v2board.app_exclude_routes'));

        return $headers;
    }

    private function buildResponse($body, array $headers)
    {
        $response = response($body, 200);
        foreach ($headers as $name => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $response->header($name, (string) $value);
        }
        return $response;
    }

    private function addHeader(array &$headers, $name, $value)
    {
        if ($value === null || $value === '') {
            return;
        }
        $headers[$name] = $value;
    }

    private function boolValue($value)
    {
        return (int) $value === 1 ? '1' : '0';
    }

    private function limitText($value, $limit)
    {
        return mb_substr((string) $value, 0, $limit);
    }

    // ==================== VMess ====================

    public static function buildVmess($uuid, $server)
    {
        $config = [
            "v" => "2",
            "ps" => $server['name'],
            "add" => Helper::formatHost($server['host']),
            "port" => (string) $server['port'],
            "id" => $uuid,
            "aid" => "0",
            "scy" => "auto",
            "net" => $server['network'],
            "type" => "none",
            "host" => "",
            "path" => "",
            "tls" => $server['tls'] ? "tls" : "",
            "fp" => "chrome",
        ];

        if ($server['tls']) {
            $tlsSettings = $server['tls_settings'] ?? $server['tlsSettings'] ?? [];
            $config['allowInsecure'] = (int) ($tlsSettings['allow_insecure'] ?? $tlsSettings['allowInsecure'] ?? 0);
            $config['sni'] = $tlsSettings['server_name'] ?? $tlsSettings['serverName'] ?? '';
        }

        if (!empty($server['happ_server_description'])) {
            $config['meta'] = [
                'serverDescription' => $server['happ_server_description'],
            ];
        }

        $networkSettings = $server['network_settings'] ?? $server['networkSettings'] ?? [];
        switch ($server['network']) {
            case 'tcp':
                if (!empty($networkSettings['header']['type']) && $networkSettings['header']['type'] === 'http') {
                    $config['type'] = $networkSettings['header']['type'];
                    $config['host'] = $networkSettings['header']['request']['headers']['Host'][0] ?? '';
                    $config['path'] = $networkSettings['header']['request']['path'][0] ?? '';
                }
                break;
            case 'ws':
                $config['path'] = $networkSettings['path'] ?? '';
                $config['host'] = $networkSettings['headers']['Host'] ?? '';
                if (isset($networkSettings['security'])) {
                    $config['scy'] = $networkSettings['security'];
                }
                break;
            case 'grpc':
                $config['path'] = $networkSettings['serviceName'] ?? '';
                break;
            case 'kcp':
                $config['type'] = $networkSettings['header']['type'] ?? 'none';
                if (isset($networkSettings['seed'])) {
                    $config['path'] = $networkSettings['seed'];
                }
                break;
            case 'httpupgrade':
                $config['path'] = $networkSettings['path'] ?? '';
                $config['host'] = $networkSettings['host'] ?? '';
                break;
            case 'xhttp':
                $config['path'] = $networkSettings['path'] ?? '';
                $config['host'] = $networkSettings['host'] ?? '';
                $config['mode'] = $networkSettings['mode'] ?? 'auto';
                if (isset($networkSettings['extra'])) {
                    $config['extra'] = json_encode($networkSettings['extra'], JSON_UNESCAPED_SLASHES);
                }
                break;
        }

        return "vmess://" . base64_encode(json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . "\r\n";
    }

    // ==================== VLESS ====================

    public static function buildVless($uuid, $server)
    {
        $name = Helper::encodeURIComponent($server['name']);
        $tlsSettings = $server['tls_settings'] ?? [];

        $params = [
            'type' => $server['network'],
            'encryption' => 'none',
            'security' => $server['tls'] != 0 ? ($server['tls'] == 2 ? 'reality' : 'tls') : '',
            'fp' => $tlsSettings['fingerprint'] ?? 'chrome',
        ];

        if (!empty($server['flow'])) {
            $params['flow'] = $server['flow'];
        }

        if ($server['tls']) {
            $params['sni'] = $tlsSettings['server_name'] ?? '';
            $params['allowInsecure'] = $tlsSettings['allow_insecure'] ?? 0;
            if ($server['tls'] == 2) {
                $params['pbk'] = $tlsSettings['public_key'] ?? '';
                $params['sid'] = $tlsSettings['short_id'] ?? '';
            }
        }

        if (isset($server['encryption']) && $server['encryption'] === 'mlkem768x25519plus') {
            $encSettings = $server['encryption_settings'] ?? [];
            $enc = 'mlkem768x25519plus.' . ($encSettings['mode'] ?? 'native') . '.' . ($encSettings['rtt'] ?? '1rtt');
            if (!empty($encSettings['client_padding'])) {
                $enc .= '.' . $encSettings['client_padding'];
            }
            $enc .= '.' . ($encSettings['password'] ?? '');
            $params['encryption'] = $enc;
        }

        self::applyNetworkSettings($server, $params);

        $host = Helper::formatHost($server['host']);
        $port = $server['port'];
        $query = http_build_query($params);

        return self::appendHappFragmentOptions("vless://{$uuid}@{$host}:{$port}?{$query}#{$name}\r\n", $server);
    }

    // ==================== Trojan ====================

    public static function buildTrojan($password, $server)
    {
        $tlsSettings = $server['tls_settings'] ?? [];
        $networkSettings = $server['network_settings'] ?? $server['networkSettings'] ?? [];
        $network = $server['network'] ?? 'tcp';

        $params = [
            'security' => 'tls',
            'allowInsecure' => $server['allow_insecure'] ?? ($tlsSettings['allow_insecure'] ?? 0),
            'sni' => $server['server_name'] ?? ($tlsSettings['server_name'] ?? ''),
            'type' => $network,
        ];

        if (isset($tlsSettings['fingerprint']) && !empty($tlsSettings['fingerprint'])) {
            $params['fp'] = $tlsSettings['fingerprint'];
        }

        if ($network === 'ws') {
            $params['path'] = $networkSettings['path'] ?? '';
            $params['host'] = $networkSettings['headers']['Host'] ?? ($networkSettings['host'] ?? '');
        } elseif ($network === 'grpc') {
            $params['serviceName'] = $networkSettings['serviceName'] ?? '';
        }

        $host = Helper::formatHost($server['host']);
        $port = $server['port'];
        $name = rawurlencode($server['name']);
        $query = http_build_query($params);

        return self::appendHappFragmentOptions("trojan://{$password}@{$host}:{$port}?{$query}#{$name}\r\n", $server);
    }

    // ==================== Shadowsocks ====================

    public static function buildShadowsocks($uuid, $server)
    {
        $cipher = $server['cipher'];
        if (strpos($cipher, '2022-blake3') !== false) {
            $length = $cipher === '2022-blake3-aes-128-gcm' ? 16 : 32;
            $serverKey = Helper::getServerKey($server['created_at'], $length);
            $userKey = Helper::uuidToBase64($uuid, $length);
            $password = "{$serverKey}:{$userKey}";
        } else {
            $password = $uuid;
        }

        $name = rawurlencode($server['name']);
        $encoded = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode("{$cipher}:{$password}"));
        $host = Helper::formatHost($server['host']);
        $port = $server['port'];

        $uri = "ss://{$encoded}@{$host}:{$port}";

        if (isset($server['obfs']) && $server['obfs'] === 'http') {
            $uri .= "?plugin=obfs-local;obfs=http;obfs-host={$server['obfs-host']};path={$server['obfs-path']}";
        } elseif (($server['network'] ?? null) === 'http' && isset($server['network_settings']['Host'])) {
            $path = $server['network_settings']['path'] ?? '/';
            $uri .= "?plugin=obfs-local;obfs=tls;obfs-host={$server['network_settings']['Host']};path={$path}";
        }

        return self::appendHappFragmentOptions("{$uri}#{$name}\r\n", $server);
    }

    // ==================== Hysteria (v1) ====================

    public static function buildHysteria($password, $server)
    {
        // Happ only supports Hysteria2 (hy2:// scheme)
        // Convert Hysteria v1 to v2 format if possible, skip v1
        if (($server['version'] ?? 1) == 2) {
            return self::buildHysteria2FromLegacy($password, $server);
        }
        // Hysteria v1 is not supported by Happ, skip
        return '';
    }

    // ==================== Hysteria2 ====================

    public static function buildHysteria2($password, $server)
    {
        $tlsSettings = $server['tls_settings'] ?? [];
        $host = Helper::formatHost($server['host']);
        $name = Helper::encodeURIComponent($server['name']);

        $parts = explode(',', $server['port']);
        $firstPort = strpos($parts[0], '-') !== false ? explode('-', $parts[0])[0] : $parts[0];

        $insecure = $tlsSettings['allow_insecure'] ?? 0;
        $sni = $tlsSettings['server_name'] ?? '';

        $uri = "hy2://{$password}@{$host}:{$firstPort}/?insecure={$insecure}&sni={$sni}";

        if (!empty($server['obfs']) && !empty($server['obfs_password'])) {
            $obfsPassword = rawurlencode($server['obfs_password']);
            $uri .= "&obfs={$server['obfs']}&obfs-password={$obfsPassword}";
        }

        // Multi-port support (Happ supports mport parameter)
        if (count($parts) !== 1 || strpos($parts[0], '-') !== false) {
            $uri .= "&mport=" . rawurlencode($server['mport'] ?? $server['port']);
        }

        return self::appendHappFragmentOptions("{$uri}#{$name}\r\n", $server);
    }

    private static function buildHysteria2FromLegacy($password, $server)
    {
        $host = Helper::formatHost($server['host']);
        $name = Helper::encodeURIComponent($server['name']);

        $parts = explode(',', $server['port']);
        $firstPort = strpos($parts[0], '-') !== false ? explode('-', $parts[0])[0] : $parts[0];

        $uri = "hy2://{$password}@{$host}:{$firstPort}/?insecure={$server['insecure']}&sni={$server['server_name']}";

        if (!empty($server['obfs']) && !empty($server['obfs_password'])) {
            $obfsPassword = rawurlencode($server['obfs_password']);
            $uri .= "&obfs={$server['obfs']}&obfs-password={$obfsPassword}";
        }

        if (count($parts) !== 1 || strpos($parts[0], '-') !== false) {
            $uri .= "&mport=" . rawurlencode($server['mport'] ?? $server['port']);
        }

        return self::appendHappFragmentOptions("{$uri}#{$name}\r\n", $server);
    }

    // ==================== TUIC ====================

    public static function buildTuic($password, $server)
    {
        // TUIC is not natively supported by Happ
        // Convert to a compatible comment line for reference
        return '';
    }

    // ==================== AnyTLS ====================

    public static function buildAnytls($password, $server)
    {
        // Happ does not natively support anytls:// scheme
        // AnyTLS may be handled via xray-core internally
        // Output as standard URI for forward compatibility
        $tlsSettings = $server['tls_settings'] ?? [];
        $params = [
            'type' => $server['network'] ?? 'tcp',
            'insecure' => $server['insecure'] ?? ($tlsSettings['allow_insecure'] ?? 0),
            'fp' => $tlsSettings['fingerprint'] ?? 'chrome',
        ];

        if (isset($server['server_name']) || isset($tlsSettings['server_name'])) {
            $params['sni'] = $server['server_name'] ?? ($tlsSettings['server_name'] ?? '');
        }

        if (isset($server['tls']) && $server['tls'] == 2) {
            $params['security'] = 'reality';
            $params['pbk'] = $tlsSettings['public_key'] ?? '';
            $params['sid'] = $tlsSettings['short_id'] ?? '';
        }

        $host = Helper::formatHost($server['host']);
        $port = $server['port'];
        $name = Helper::encodeURIComponent($server['name']);

        if (isset($server['network']) && isset($server['network_settings'])) {
            self::applyNetworkSettings($server, $params);
        }

        $query = http_build_query($params);
        return self::appendHappFragmentOptions("anytls://{$password}@{$host}:{$port}/?{$query}#{$name}\r\n", $server);
    }

    // ==================== Network Settings Helper ====================

    private static function applyNetworkSettings($server, &$params)
    {
        $network = $server['network'] ?? 'tcp';
        $settings = $server['network_settings'] ?? $server['networkSettings'] ?? [];

        switch ($network) {
            case 'tcp':
                $header = $settings['header'] ?? [];
                if (isset($header['type']) && $header['type'] === 'http') {
                    $params['headerType'] = 'http';
                    $params['host'] = $header['request']['headers']['Host'][0] ?? '';
                    $params['path'] = $header['request']['path'][0] ?? '';
                }
                break;
            case 'ws':
                $params['path'] = $settings['path'] ?? '';
                $params['host'] = $settings['headers']['Host'] ?? '';
                break;
            case 'grpc':
                $params['serviceName'] = $settings['serviceName'] ?? '';
                break;
            case 'kcp':
                $params['headerType'] = $settings['header']['type'] ?? 'none';
                if (isset($settings['seed'])) {
                    $params['seed'] = $settings['seed'];
                }
                break;
            case 'httpupgrade':
                $params['path'] = $settings['path'] ?? '';
                $params['host'] = $settings['host'] ?? '';
                break;
            case 'xhttp':
                $params['path'] = $settings['path'] ?? '';
                $params['host'] = $settings['host'] ?? '';
                $params['mode'] = $settings['mode'] ?? 'auto';
                if (isset($settings['extra'])) {
                    $params['extra'] = json_encode($settings['extra'], JSON_UNESCAPED_SLASHES);
                }
                break;
        }
    }

    private static function appendHappFragmentOptions($uri, array $server = [])
    {
        $line = rtrim($uri, "\r\n");
        if (strpos($line, '#') === false) {
            return $uri;
        }

        $uriParams = [];
        $metaParams = [];
        $fragmentLength = trim((string) config('v2board.app_fragment_length', ''));
        $fragmentInterval = trim((string) config('v2board.app_fragment_interval', ''));
        $fragmentPackets = trim((string) config('v2board.app_fragment_packets', ''));
        if ((int) config('v2board.app_fragment_enable', 0) === 1 && $fragmentLength !== '' && $fragmentInterval !== '' && $fragmentPackets !== '') {
            $uriParams['fragment'] = "{$fragmentLength},{$fragmentInterval},{$fragmentPackets}";
        }

        $resolveAddress = trim((string) config('v2board.app_resolve_address', ''));
        $host = trim((string) config('v2board.app_host', ''));
        if ($resolveAddress !== '') {
            $uriParams['resolve-address'] = $resolveAddress;
        }
        if ($host !== '') {
            $uriParams['host'] = $host;
        }
        if ((int) config('v2board.app_insecure', 0) === 1) {
            $uriParams['insecure'] = '1';
        }
        if (!empty($server['happ_server_description'])) {
            $metaParams['serverDescription'] = base64_encode($server['happ_server_description']);
        }

        if (empty($uriParams) && empty($metaParams)) {
            return $uri;
        }

        $parts = explode('#', $line, 2);
        $base = $parts[0];
        $title = $parts[1];

        if (!empty($uriParams)) {
            $base .= (strpos($base, '?') === false ? '?' : '&')
                . http_build_query($uriParams, '', '&', PHP_QUERY_RFC3986);
        }

        $line = $base . '#' . $title;
        if (!empty($metaParams)) {
            $line .= '?' . http_build_query($metaParams, '', '&', PHP_QUERY_RFC3986);
        }

        return $line . "\r\n";
    }
}
