<?php

namespace App\Protocols;

use App\Utils\Helper;

class Hiddify
{
    public $flag = 'hiddify';

    private const DEFAULT_PROFILE_UPDATE_INTERVAL = 2;
    private const MAX_PROFILE_TITLE_LENGTH = 64;
    private const MILLISECOND_TIMESTAMP_THRESHOLD = 32000000000;
    private const SKIPPED_SCHEMES = ['ssr'];

    private $servers;
    private $user;
    private $options;

    public function __construct($user, $servers, array $options = null)
    {
        $this->user = $user;
        $this->servers = $servers;
        $this->options = $options ?? [];
    }

    public function handle()
    {
        $appName = $this->getSubscriptionName();
        $body = base64_encode($this->buildSubscriptionBody($appName));
        $headers = $this->buildHeaders($appName);

        $response = response($body, 200);
        foreach ($headers as $name => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $response->header($name, $value);
        }

        return $response;
    }

    protected function buildSubscriptionBody($appName)
    {
        $lines = $this->buildBodyMetadataLines($appName);

        foreach ($this->servers as $server) {
            $uri = $this->buildAppUri($server);
            if ($uri !== null && $uri !== '') {
                $lines[] = $uri;
            }
        }

        return implode("\n", $lines);
    }

    protected function buildHeaders($appName)
    {
        return [
            'profile-title' => $this->getProfileTitleHeader($appName),
            'profile-update-interval' => (string) $this->getProfileUpdateInterval(),
            'subscription-userinfo' => $this->getUserInfoHeader($this->user),
            'support-url' => $this->getSupportUrl(),
            'profile-web-page-url' => $this->getProfileWebPageUrl(),
            'DNS' => $this->getDnsHeader(),
            'moved-permanently-to' => $this->getMovedPermanentlyToHeader(),
            'content-disposition' => $this->getContentDispositionHeader($appName),
        ];
    }

    protected function buildBodyMetadataLines($appName)
    {
        $lines = [];

        $profileTitle = $this->getProfileTitleHeader($appName);
        if ($profileTitle !== null) {
            $lines[] = '#profile-title: ' . $profileTitle;
        }

        $lines[] = '#profile-update-interval: ' . $this->getProfileUpdateInterval();

        $userInfo = $this->getUserInfoHeader($this->user);
        if ($userInfo !== null) {
            $lines[] = '#subscription-userinfo: ' . $userInfo;
        }

        $supportUrl = $this->getSupportUrl();
        if ($supportUrl !== null) {
            $lines[] = '#support-url: ' . $supportUrl;
        }

        $profileWebPageUrl = $this->getProfileWebPageUrl();
        if ($profileWebPageUrl !== null) {
            $lines[] = '#profile-web-page-url: ' . $profileWebPageUrl;
        }

        $dns = $this->getDnsHeader();
        if ($dns !== null) {
            $lines[] = '#DNS: ' . $dns;
        }

        $movedPermanentlyTo = $this->getMovedPermanentlyToHeader();
        if ($movedPermanentlyTo !== null) {
            $lines[] = '#moved-permanently-to: ' . $movedPermanentlyTo;
        }

        return array_slice($lines, 0, 10);
    }

    protected function buildAppUri($server)
    {
        $baseUri = trim((string) Helper::buildUri($this->user['uuid'], $server));
        $baseUri = rtrim($baseUri, "_ \t\n\r\0\x0B");

        if ($baseUri === '') {
            return null;
        }

        $scheme = $this->getUriScheme($baseUri);
        if ($scheme !== null && in_array($scheme, self::SKIPPED_SCHEMES, true)) {
            return null;
        }

        switch ($scheme) {
            case 'vless':
                return $this->normalizeVlessUri($baseUri);
            case 'vmess':
                return $this->normalizeVmessUri($baseUri);
            case 'trojan':
                return $this->normalizeTrojanUri($baseUri);
            case 'ss':
                return $this->normalizeShadowsocksUri($baseUri);
            case 'tuic':
                return $this->normalizeTuicUri($baseUri);
            case 'hysteria':
                return $this->normalizeHysteriaUri($baseUri);
            case 'hysteria2':
            case 'hy2':
                return $this->normalizeHysteria2Uri($baseUri);
            case 'ssh':
                return $this->normalizeSshUri($baseUri);
            case 'wireguard':
            case 'wg':
                return $this->normalizeWireGuardUri($baseUri);
            case 'socks':
            case 'socks5':
                return $this->normalizeSocksUri($baseUri);
        }

        return $this->normalizeRawShareUri($baseUri);
    }

    protected function normalizeVlessUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (empty($query['encryption'])) {
            $query['encryption'] = 'none';
        }
        if (empty($query['type'])) {
            $query['type'] = 'tcp';
        }
        if (empty($query['security'])) {
            $query['security'] = 'none';
        }

        $query['type'] = $this->normalizeTransportType($query['type']);

        if (in_array($query['security'], ['tls', 'reality'], true) && empty($query['sni'])) {
            $query['sni'] = $this->normalizeSniHost($parts['host']);
        }

        $fingerprint = $this->getFirstOption(['vless_fingerprint', 'tls_fingerprint', 'fingerprint']);
        if ($fingerprint !== null && empty($query['fp'])) {
            $query['fp'] = $fingerprint;
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeVmessUri($baseUri)
    {
        $payload = substr($baseUri, strlen('vmess://'));
        $decodedPayload = base64_decode($this->normalizeBase64Payload($payload), true);
        if ($decodedPayload !== false) {
            $config = json_decode($decodedPayload, true);
            if (is_array($config)) {
                if (empty($config['scy'])) {
                    $config['scy'] = 'auto';
                }
                if (!isset($config['aid']) || $config['aid'] === '') {
                    $config['aid'] = 0;
                }
                if (empty($config['net'])) {
                    $config['net'] = 'tcp';
                }

                $config['net'] = $this->normalizeTransportType($config['net']);

                if (isset($config['ps']) && is_string($config['ps'])) {
                    $config['ps'] = trim($config['ps']);
                }

                if (isset($config['tls']) && $config['tls'] === 'none') {
                    $config['tls'] = '';
                }

                if (!empty($config['security']) && empty($config['tls']) && $config['security'] === 'tls') {
                    $config['tls'] = 'tls';
                    unset($config['security']);
                }

                if (!empty($config['tls']) && empty($config['sni']) && !empty($config['add'])) {
                    $config['sni'] = $config['add'];
                }

                $fingerprint = $this->getFirstOption(['vmess_fingerprint', 'tls_fingerprint', 'fingerprint']);
                if ($fingerprint !== null && empty($config['fp'])) {
                    $config['fp'] = $fingerprint;
                }

                $normalizedJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($normalizedJson !== false) {
                    return 'vmess://' . base64_encode($normalizedJson);
                }
            }
        }

        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (empty($query['type'])) {
            $query['type'] = 'tcp';
        }
        if (empty($query['security'])) {
            $query['security'] = 'none';
        }

        $query['type'] = $this->normalizeTransportType($query['type']);

        if (in_array($query['security'], ['tls', 'reality'], true) && empty($query['sni'])) {
            $query['sni'] = $this->normalizeSniHost($parts['host']);
        }

        $fingerprint = $this->getFirstOption(['vmess_fingerprint', 'tls_fingerprint', 'fingerprint']);
        if ($fingerprint !== null && empty($query['fp'])) {
            $query['fp'] = $fingerprint;
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeTrojanUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (empty($query['security'])) {
            $query['security'] = 'tls';
        }

        if (empty($query['type'])) {
            $query['type'] = 'tcp';
        }

        $query['type'] = $this->normalizeTransportType($query['type']);

        if (empty($query['sni'])) {
            $query['sni'] = !empty($query['peer']) ? $query['peer'] : $this->normalizeSniHost($parts['host']);
        }

        $fingerprint = $this->getFirstOption(['trojan_fingerprint', 'tls_fingerprint', 'fingerprint']);
        if ($fingerprint !== null && empty($query['fp'])) {
            $query['fp'] = $fingerprint;
        }

        $allowInsecure = $this->getAllowInsecureOption();
        if ($allowInsecure !== null && !isset($query['allowInsecure'])) {
            $query['allowInsecure'] = $allowInsecure ? '1' : '0';
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeShadowsocksUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null || $parts['userinfo'] === null || $parts['host'] === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        return $this->buildShareUri($parts, $this->parseQueryString($parts['query']));
    }

    protected function normalizeTuicUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (isset($query['congestionControl']) && !isset($query['congestion_control'])) {
            $query['congestion_control'] = $query['congestionControl'];
            unset($query['congestionControl']);
        }

        if (isset($query['udpRelayMode']) && !isset($query['udp_relay_mode'])) {
            $query['udp_relay_mode'] = $query['udpRelayMode'];
            unset($query['udpRelayMode']);
        }

        if (isset($query['allowInsecure']) && !isset($query['allow_insecure'])) {
            $query['allow_insecure'] = $this->normalizeBooleanQueryValue($query['allowInsecure']);
            unset($query['allowInsecure']);
        }

        if (empty($query['sni'])) {
            $query['sni'] = $this->normalizeSniHost($parts['host']);
        }

        if (empty($query['congestion_control'])) {
            $congestionControl = $this->getFirstOption(['tuic_congestion_control', 'congestion_control']);
            if ($congestionControl !== null) {
                $query['congestion_control'] = $congestionControl;
            }
        }

        if (empty($query['udp_relay_mode'])) {
            $udpRelayMode = $this->getFirstOption(['tuic_udp_relay_mode', 'udp_relay_mode']);
            if ($udpRelayMode !== null) {
                $query['udp_relay_mode'] = $udpRelayMode;
            }
        }

        if (empty($query['alpn'])) {
            $alpn = $this->getFirstOption(['tuic_alpn']);
            if ($alpn !== null) {
                $query['alpn'] = $alpn;
            }
        }

        $allowInsecure = $this->getAllowInsecureOption();
        if ($allowInsecure !== null && !isset($query['allow_insecure']) && !isset($query['allowInsecure'])) {
            $query['allow_insecure'] = $allowInsecure ? '1' : '0';
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeHysteriaUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (isset($query['allowInsecure']) && !isset($query['insecure'])) {
            $query['insecure'] = $this->normalizeBooleanQueryValue($query['allowInsecure']);
            unset($query['allowInsecure']);
        }

        if (empty($query['peer'])) {
            $query['peer'] = !empty($query['sni']) ? $query['sni'] : $this->normalizeSniHost($parts['host']);
        }

        if (empty($query['protocol'])) {
            $protocol = $this->getFirstOption(['hysteria_protocol']);
            if ($protocol !== null) {
                $query['protocol'] = $protocol;
            }
        }

        $allowInsecure = $this->getAllowInsecureOption();
        if ($allowInsecure !== null && !isset($query['insecure'])) {
            $query['insecure'] = $allowInsecure ? '1' : '0';
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeHysteria2Uri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        if ($parts['path'] === null || $parts['path'] === '') {
            $parts['path'] = '/';
        }

        $query = $this->parseQueryString($parts['query']);

        if (empty($query['sni'])) {
            $query['sni'] = !empty($query['peer']) ? $query['peer'] : $this->normalizeSniHost($parts['host']);
        }

        if (isset($query['allowInsecure']) && !isset($query['insecure'])) {
            $query['insecure'] = $this->normalizeBooleanQueryValue($query['allowInsecure']);
            unset($query['allowInsecure']);
        }

        if (isset($query['allow_insecure']) && !isset($query['insecure'])) {
            $query['insecure'] = $this->normalizeBooleanQueryValue($query['allow_insecure']);
            unset($query['allow_insecure']);
        }

        if (isset($query['obfsParam']) && !isset($query['obfs-password'])) {
            $query['obfs-password'] = $query['obfsParam'];
        }

        $allowInsecure = $this->getAllowInsecureOption();
        if ($allowInsecure !== null && !isset($query['insecure'])) {
            $query['insecure'] = $allowInsecure ? '1' : '0';
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeSshUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        if ($parts['path'] === null || $parts['path'] === '') {
            $parts['path'] = '/';
        }

        $query = $this->parseQueryString($parts['query']);
        $this->moveFirstExistingQueryKey($query, ['private_key', 'privateKey'], 'pk');
        $this->moveFirstExistingQueryKey($query, ['host_key', 'hostKey'], 'hk');

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeSocksUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        return $this->buildShareUri($parts, $this->parseQueryString($parts['query']));
    }

    protected function normalizeWireGuardUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $parts['scheme'] = 'wg';
        $parts['path'] = '/';

        $query = $this->parseQueryString($parts['query']);

        if ($parts['userinfo'] !== null) {
            if (!isset($query['pk'])) {
                $query['pk'] = rawurldecode($parts['userinfo']);
            }

            $parts['userinfo'] = null;
        }

        $this->moveFirstExistingQueryKey($query, ['private_key', 'privateKey', 'secretKey', 'secretkey'], 'pk');
        $this->moveFirstExistingQueryKey($query, ['address', 'local-address', 'localAddress'], 'local_address');
        $this->moveFirstExistingQueryKey($query, ['publicKey', 'publickey', 'peerPublicKey', 'peer_public_key'], 'peer_pk');
        $this->moveFirstExistingQueryKey($query, ['preSharedKey', 'presharedKey', 'preshared_key', 'preShared_key'], 'pre_shared_key');

        if (empty($query['workers'])) {
            $workers = $this->getFirstOption(['wireguard_workers', 'workers']);
            if ($workers !== null) {
                $query['workers'] = $workers;
            }
        }

        if (empty($query['mtu'])) {
            $mtu = $this->getFirstOption(['wireguard_mtu', 'mtu']);
            if ($mtu !== null) {
                $query['mtu'] = $mtu;
            }
        }

        if (!empty($query['local_address'])) {
            $query['local_address'] = preg_replace('/\s+/', '', $query['local_address']);
        }

        if (!empty($query['reserved'])) {
            $query['reserved'] = preg_replace('/\s+/', '', $query['reserved']);
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function parseShareUri($uri)
    {
        $scheme = $this->getUriScheme($uri);
        if ($scheme === null) {
            return null;
        }

        $prefix = $scheme . '://';
        if (strpos($uri, $prefix) !== 0) {
            return null;
        }

        $rest = substr($uri, strlen($prefix));
        $fragment = null;
        $fragmentPosition = strpos($rest, '#');
        if ($fragmentPosition !== false) {
            $fragment = substr($rest, $fragmentPosition + 1);
            $rest = substr($rest, 0, $fragmentPosition);
        }

        $queryString = null;
        $queryPosition = strpos($rest, '?');
        if ($queryPosition !== false) {
            $queryString = substr($rest, $queryPosition + 1);
            $rest = substr($rest, 0, $queryPosition);
        }

        $path = null;
        $pathPosition = strpos($rest, '/');
        if ($pathPosition !== false) {
            $path = substr($rest, $pathPosition);
            $rest = substr($rest, 0, $pathPosition);
        }

        $authority = $this->splitShareAuthority($rest);
        if ($authority === null) {
            return null;
        }

        return [
            'scheme' => $scheme,
            'userinfo' => $authority['userinfo'],
            'host' => $authority['host'],
            'port' => $authority['port'],
            'path' => $path,
            'query' => $queryString,
            'fragment' => $fragment,
        ];
    }

    protected function splitShareAuthority($authority)
    {
        if ($authority === '') {
            return null;
        }

        $userinfo = null;
        $hostPort = $authority;
        $atPosition = strrpos($authority, '@');
        if ($atPosition !== false) {
            $userinfo = substr($authority, 0, $atPosition);
            $hostPort = substr($authority, $atPosition + 1);
        }

        if ($hostPort === '') {
            return null;
        }

        $host = $hostPort;
        $port = null;

        if (strpos($hostPort, '[') === 0) {
            $endBracketPosition = strpos($hostPort, ']');
            if ($endBracketPosition === false) {
                return null;
            }

            $host = substr($hostPort, 0, $endBracketPosition + 1);
            $remainder = substr($hostPort, $endBracketPosition + 1);
            if ($remainder !== '' && strpos($remainder, ':') === 0) {
                $port = substr($remainder, 1);
            }
        } else {
            $colonPosition = strrpos($hostPort, ':');
            if ($colonPosition !== false) {
                $host = substr($hostPort, 0, $colonPosition);
                $port = substr($hostPort, $colonPosition + 1);
            }
        }

        if ($host === '') {
            return null;
        }

        return [
            'userinfo' => $userinfo !== '' ? $userinfo : null,
            'host' => $host,
            'port' => $port !== '' ? $port : null,
        ];
    }

    protected function buildShareUri(array $parts, array $query = [])
    {
        $uri = $parts['scheme'] . '://';
        if ($parts['userinfo'] !== null && $parts['userinfo'] !== '') {
            $uri .= $parts['userinfo'] . '@';
        }

        $uri .= $this->formatUriHost($parts['host']);

        if ($parts['port'] !== null && $parts['port'] !== '') {
            $uri .= ':' . $parts['port'];
        }

        if (!empty($parts['path'])) {
            $uri .= $parts['path'];
        }

        $queryString = $this->buildQueryString($query);
        if ($queryString !== '') {
            $uri .= '?' . $queryString;
        }

        $fragment = $this->normalizeFragment($parts['fragment']);
        if ($fragment !== null) {
            $uri .= '#' . $fragment;
        }

        return $uri;
    }

    protected function parseQueryString($queryString)
    {
        $query = [];
        if ($queryString === null || $queryString === '') {
            return $query;
        }

        foreach (explode('&', $queryString) as $segment) {
            if ($segment === '') {
                continue;
            }

            $pair = explode('=', $segment, 2);
            $key = rawurldecode($pair[0]);
            $value = isset($pair[1]) ? rawurldecode($pair[1]) : '';

            if ($key === '') {
                continue;
            }

            $query[$key] = $value;
        }

        return $query;
    }

    protected function buildQueryString(array $query)
    {
        $filteredQuery = [];
        foreach ($query as $key => $value) {
            if ($key === '' || $value === null || $value === '') {
                continue;
            }

            $filteredQuery[$key] = $value;
        }

        return http_build_query($filteredQuery, '', '&', PHP_QUERY_RFC3986);
    }

    protected function moveFirstExistingQueryKey(array &$query, array $sourceKeys, $targetKey)
    {
        if (isset($query[$targetKey]) && $query[$targetKey] !== '') {
            return;
        }

        foreach ($sourceKeys as $sourceKey) {
            if (!isset($query[$sourceKey]) || $query[$sourceKey] === '') {
                continue;
            }

            $query[$targetKey] = $query[$sourceKey];
            if ($sourceKey !== $targetKey) {
                unset($query[$sourceKey]);
            }

            return;
        }
    }

    protected function normalizeTransportType($type)
    {
        if (!is_string($type) || $type === '') {
            return $type;
        }

        return strtolower($type) === 'splithttp' ? 'xhttp' : $type;
    }

    protected function normalizeSniHost($host)
    {
        if (!is_string($host) || $host === '') {
            return null;
        }

        return trim($host, '[]');
    }

    protected function normalizeBase64Payload($payload)
    {
        $payload = trim((string) $payload);
        $payload = str_replace(['-', '_'], ['+', '/'], $payload);
        $padding = strlen($payload) % 4;
        if ($padding !== 0) {
            $payload .= str_repeat('=', 4 - $padding);
        }

        return $payload;
    }

    protected function normalizeBooleanQueryValue($value)
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        $normalizedValue = strtolower(trim((string) $value));
        if (in_array($normalizedValue, ['1', 'true', 'yes', 'on'], true)) {
            return '1';
        }

        if (in_array($normalizedValue, ['0', 'false', 'no', 'off'], true)) {
            return '0';
        }

        return (string) $value;
    }

    protected function normalizeFragment($fragment)
    {
        if ($fragment === null) {
            return null;
        }

        return $this->sanitizeMultilineText($fragment);
    }

    protected function normalizeRawShareUri($baseUri)
    {
        $fragmentPosition = strpos($baseUri, '#');
        if ($fragmentPosition === false) {
            return $baseUri;
        }

        $prefix = substr($baseUri, 0, $fragmentPosition);
        $fragment = $this->normalizeFragment(substr($baseUri, $fragmentPosition + 1));

        return $fragment === null ? $prefix : $prefix . '#' . $fragment;
    }

    protected function getFirstOption(array $keys)
    {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $this->options)) {
                continue;
            }

            $value = $this->options[$key];
            if ($value === null || $value === '') {
                continue;
            }

            return $value;
        }

        return null;
    }

    protected function getAllowInsecureOption()
    {
        if (array_key_exists('allow_insecure', $this->options)) {
            return (bool) $this->options['allow_insecure'];
        }

        if (array_key_exists('allowInsecure', $this->options)) {
            return (bool) $this->options['allowInsecure'];
        }

        return null;
    }

    protected function formatUriHost($host)
    {
        if (!is_string($host) || $host === '') {
            return $host;
        }

        if (strpos($host, ':') !== false && strpos($host, '[') !== 0) {
            return '[' . $host . ']';
        }

        return $host;
    }

    protected function getSubscriptionName()
    {
        $name = $this->sanitizeMultilineText(
            $this->options['profile_title']
            ?? $this->options['subscription_name']
            ?? config('v2board.app_name', 'V2Board')
        );

        if ($name === null) {
            return 'V2Board';
        }

        return explode("\n", $name, 2)[0];
    }

    protected function getProfileTitleHeader($appName)
    {
        $title = $this->getPlainProfileTitle($appName);
        if ($title === null) {
            return null;
        }

        if (!empty($this->options['profile_title_base64']) || preg_match('/[^\x20-\x7E]/', $title) === 1) {
            return 'base64:' . base64_encode($title);
        }

        return $title;
    }

    protected function getPlainProfileTitle($appName)
    {
        $title = $this->sanitizeMultilineText($appName);
        if ($title === null) {
            return null;
        }

        $title = explode("\n", $title, 2)[0];

        return $this->limitText($title, self::MAX_PROFILE_TITLE_LENGTH);
    }

    protected function getProfileUpdateInterval()
    {
        $interval = (int) ($this->options['profile_update_interval'] ?? self::DEFAULT_PROFILE_UPDATE_INTERVAL);

        return $interval > 0 ? $interval : self::DEFAULT_PROFILE_UPDATE_INTERVAL;
    }

    protected function getProfileWebPageUrl()
    {
        return $this->sanitizeHeaderValue(
            $this->options['profile_web_page_url']
            ?? $this->options['homepage']
            ?? null
        );
    }

    protected function getSupportUrl()
    {
        return $this->sanitizeHeaderValue($this->options['support_url'] ?? null);
    }

    protected function getDnsHeader()
    {
        return $this->sanitizeHeaderValue($this->options['DNS'] ?? $this->options['dns'] ?? null);
    }

    protected function getMovedPermanentlyToHeader()
    {
        return $this->sanitizeHeaderValue(
            $this->options['moved_permanently_to']
            ?? $this->options['moved-permanently-to']
            ?? null
        );
    }

    protected function getUserInfoHeader($user)
    {
        $parts = [];

        if (isset($user['u'])) {
            $parts[] = 'upload=' . (int) $user['u'];
        }
        if (isset($user['d'])) {
            $parts[] = 'download=' . (int) $user['d'];
        }
        if (isset($user['transfer_enable'])) {
            $parts[] = 'total=' . (int) $user['transfer_enable'];
        }

        $expire = $this->normalizeTimestamp($user['expired_at'] ?? null);
        if ($expire !== null) {
            $parts[] = 'expire=' . $expire;
        }

        if (empty($parts)) {
            return null;
        }

        return implode('; ', $parts);
    }

    protected function getContentDispositionHeader($appName)
    {
        $fileName = $this->getPlainProfileTitle($appName);
        if ($fileName === null) {
            return null;
        }

        $fileName = preg_replace('/[\\\\\\/";]+/', '_', $fileName);

        return 'attachment; filename="' . $fileName . '"';
    }

    protected function getUriScheme($uri)
    {
        $scheme = parse_url($uri, PHP_URL_SCHEME);
        if (!is_string($scheme) || $scheme === '') {
            return null;
        }

        return strtolower($scheme);
    }

    protected function normalizeTimestamp($value)
    {
        if ($value === null || $value === '') {
            return null;
        }

        $timestamp = (int) $value;
        if ($timestamp > self::MILLISECOND_TIMESTAMP_THRESHOLD) {
            $timestamp = (int) floor($timestamp / 1000);
        }

        return $timestamp > 0 ? $timestamp : null;
    }

    protected function sanitizeHeaderValue($value)
    {
        if ($value === null) {
            return null;
        }

        $value = preg_replace('/[\r\n]+/', ' ', (string) $value);
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
        $value = trim($value);

        return $value !== '' ? $value : null;
    }

    protected function sanitizeMultilineText($value)
    {
        if ($value === null) {
            return null;
        }

        $value = str_replace(["\r\n", "\r"], "\n", (string) $value);
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
        $value = trim($value);

        return $value !== '' ? $value : null;
    }

    protected function limitText($value, $maxLength)
    {
        if ($value === null || $value === '') {
            return $value;
        }

        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            return mb_strlen($value, 'UTF-8') > $maxLength
                ? mb_substr($value, 0, $maxLength, 'UTF-8')
                : $value;
        }

        return strlen($value) > $maxLength ? substr($value, 0, $maxLength) : $value;
    }
}
