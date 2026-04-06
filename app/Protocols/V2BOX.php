<?php

namespace App\Protocols;

use App\Utils\Helper;

class V2BOX
{
    public $flag = 'v2box';
    private const DEFAULT_PROFILE_UPDATE_INTERVAL = 2;
    private const MAX_PROFILE_TITLE_LENGTH = 25;
    private const MAX_ANNOUNCE_LENGTH = 200;
    private const MAX_ANNOUNCE_LINES = 5;
    private const MILLISECOND_TIMESTAMP_THRESHOLD = 32000000000;

    // V2Box không hỗ trợ: SSR, TUIC, Hysteria v1
    private const SKIPPED_SCHEMES = ['ssr', 'tuic', 'hysteria'];

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

    // ========================================
    // Subscription Body
    // ========================================

    protected function buildSubscriptionBody($appName)
    {
        $lines = [];
        foreach ($this->servers as $server) {
            $uri = $this->buildAppUri($server);
            if ($uri !== null && $uri !== '') {
                $lines[] = $uri;
            }
        }

        $lines = array_merge($lines, $this->buildBodyMetadataLines($appName));

        return implode("\n", $lines);
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
            case 'hysteria2':
            case 'hy2':
                return $this->normalizeHysteria2Uri($baseUri);
            case 'socks':
                return $this->normalizeSocksUri($baseUri);
            case 'wireguard':
                return $this->normalizeWireGuardUri($baseUri);
        }

        return $baseUri;
    }

    // ========================================
    // Headers
    // ========================================

    protected function buildHeaders($appName)
    {
        $profileWebPageUrl = $this->sanitizeHeaderValue(
            $this->options['profile_web_page_url'] ?? $this->options['homepage'] ?? null
        );

        $headers = [
            'profile-title' => $this->getProfileTitleHeader($appName),
            'subscription-userinfo' => $this->getUserInfoHeader($this->user),
            'profile-update-interval' => (string) $this->getProfileUpdateInterval(),
            'support-url' => $this->sanitizeHeaderValue($this->options['support_url'] ?? null),
            'profile-web-page-url' => $profileWebPageUrl,
            'announce' => $this->getAnnounceHeader($this->options['announce'] ?? null),
            'announce-url' => $this->sanitizeHeaderValue($this->options['announce_url'] ?? null),
            'content-disposition' => $this->getContentDispositionHeader($appName),
        ];

        // routing (base64 JSON config) - ghi đè routing trong app
        if (!empty($this->options['routing'])) {
            $headers['routing'] = $this->sanitizeHeaderValue($this->options['routing']);
        }

        // update-always: bắt buộc cập nhật mỗi lần mở app (khi VPN tắt)
        if (array_key_exists('update_always', $this->options)) {
            $headers['update-always'] = $this->options['update_always'] ? 'true' : 'false';
        }

        return $headers;
    }

    protected function buildBodyMetadataLines($appName)
    {
        $lines = [];

        $profileTitle = $this->getProfileTitleHeader($appName);
        if ($profileTitle !== null) {
            $lines[] = '#profile-title: ' . $profileTitle;
        }

        $supportUrl = $this->sanitizeHeaderValue($this->options['support_url'] ?? null);
        if ($supportUrl !== null) {
            $lines[] = '#support-url: ' . $supportUrl;
        }

        $profileWebPageUrl = $this->sanitizeHeaderValue(
            $this->options['profile_web_page_url'] ?? $this->options['homepage'] ?? null
        );
        if ($profileWebPageUrl !== null) {
            $lines[] = '#profile-web-page-url: ' . $profileWebPageUrl;
        }

        $announceUrl = $this->sanitizeHeaderValue($this->options['announce_url'] ?? null);
        if ($announceUrl !== null) {
            $lines[] = '#announce-url: ' . $announceUrl;
        }

        $announce = $this->getAnnounceHeader($this->options['announce'] ?? '');
        if ($announce !== null) {
            $lines[] = '#announce: ' . $announce;
        }

        $lines[] = '#profile-update-interval: ' . $this->getProfileUpdateInterval();

        $routing = $this->sanitizeHeaderValue($this->options['routing'] ?? null);
        if ($routing !== null) {
            $lines[] = $this->looksLikeUrl($routing)
                ? '://routing/onadd/' . $routing
                : '://routing/add/' . $routing;
        }

        return $lines;
    }

    // ========================================
    // URI Normalization
    // ========================================

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

        // V2Box hỗ trợ Reality + VLESS Vision
        if (in_array($query['security'], ['tls', 'reality'], true) && empty($query['sni'])) {
            $query['sni'] = $this->normalizeSniHost($parts['host']);
        }

        $fingerprint = $this->getFirstOption(['vless_fingerprint', 'tls_fingerprint', 'fingerprint']);
        if ($fingerprint !== null && empty($query['fp'])) {
            $query['fp'] = $fingerprint;
        }

        if (in_array($query['security'], ['tls', 'reality'], true)) {
            $query = $this->forceBooleanQueryFlag($query, 'allowInsecure');
        }

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeVmessUri($baseUri)
    {
        $payload = substr($baseUri, strlen('vmess://'));
        $decodedPayload = base64_decode($this->normalizeBase64Payload($payload), true);
        if ($decodedPayload === false) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $config = json_decode($decodedPayload, true);
        if (!is_array($config)) {
            return $this->normalizeRawShareUri($baseUri);
        }

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

        if (!empty($config['tls'])) {
            $config['allowInsecure'] = true;
        }

        $normalizedJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($normalizedJson === false) {
            return $this->normalizeRawShareUri($baseUri);
        }

        return 'vmess://' . base64_encode($normalizedJson);
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

        $query = $this->forceBooleanQueryFlag($query, 'allowInsecure');

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeShadowsocksUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null || $parts['userinfo'] === null || $parts['host'] === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeHysteria2Uri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (empty($query['sni'])) {
            $query['sni'] = $this->normalizeSniHost($parts['host']);
        }

        $fingerprint = $this->getFirstOption(['hy2_fingerprint', 'tls_fingerprint', 'fingerprint']);
        if ($fingerprint !== null && empty($query['fp'])) {
            $query['fp'] = $fingerprint;
        }

        $query = $this->forceBooleanQueryFlag($query, 'insecure');

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeSocksUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        return $this->buildShareUri($parts, $query);
    }

    protected function normalizeWireGuardUri($baseUri)
    {
        $parts = $this->parseShareUri($baseUri);
        if ($parts === null) {
            return $this->normalizeRawShareUri($baseUri);
        }

        $query = $this->parseQueryString($parts['query']);

        if (isset($query['publicKey']) && !isset($query['publickey'])) {
            $query['publickey'] = $query['publicKey'];
            unset($query['publicKey']);
        }

        if (!empty($query['address'])) {
            $query['address'] = preg_replace('/\s+/', '', $query['address']);
        }

        if (!empty($query['reserved'])) {
            $query['reserved'] = preg_replace('/\s+/', '', $query['reserved']);
        }

        if (empty($query['mtu'])) {
            $mtu = $this->getFirstOption(['wireguard_mtu', 'mtu']);
            if ($mtu !== null) {
                $query['mtu'] = $mtu;
            }
        }

        return $this->buildShareUri($parts, $query);
    }

    // ========================================
    // URI Parsing & Building
    // ========================================

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

        $authority = $this->splitShareAuthority($rest);
        if ($authority === null) {
            return null;
        }

        return [
            'scheme' => $scheme,
            'userinfo' => $authority['userinfo'],
            'host' => $authority['host'],
            'port' => $authority['port'],
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

    // ========================================
    // Normalization Helpers
    // ========================================

    protected function normalizeTransportType($type)
    {
        if (!is_string($type) || $type === '') {
            return $type;
        }

        // V2Box dùng Xray-core, hỗ trợ xhttp
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

    protected function forceBooleanQueryFlag(array $query, $key)
    {
        $query[$key] = '1';

        return $query;
    }

    // ========================================
    // Options & Config Helpers
    // ========================================

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
    // ========================================
    // Header Builders
    // ========================================

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

        if (!empty($this->options['profile_title_base64'])) {
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
            return '0';
        }

        return implode(';', $parts);
    }

    protected function getAnnounceHeader($announce)
    {
        $announce = $this->normalizeAnnounceText($announce);
        if ($announce === null) {
            return null;
        }

        // V2Box hỗ trợ announce base64 và announce có màu RGB (#RRGGBB)
        if (!empty($this->options['announce_base64']) || strpos($announce, "\n") !== false) {
            return 'base64:' . base64_encode($announce);
        }

        return $this->sanitizeHeaderValue($announce);
    }

    protected function normalizeAnnounceText($announce)
    {
        $announce = $this->sanitizeMultilineText($announce);
        if ($announce === null) {
            return null;
        }

        $lines = preg_split("/\n/", $announce);
        $lines = array_slice($lines, 0, self::MAX_ANNOUNCE_LINES);
        $announce = implode("\n", $lines);

        return $this->limitText($announce, self::MAX_ANNOUNCE_LENGTH);
    }

    protected function getProfileUpdateInterval()
    {
        $interval = (int) ($this->options['profile_update_interval'] ?? self::DEFAULT_PROFILE_UPDATE_INTERVAL);

        return $interval > 0 ? $interval : self::DEFAULT_PROFILE_UPDATE_INTERVAL;
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

    // ========================================
    // Sanitization Utilities
    // ========================================

    protected function getUriScheme($uri)
    {
        $scheme = parse_url($uri, PHP_URL_SCHEME);
        if (!is_string($scheme) || $scheme === '') {
            return null;
        }

        return strtolower($scheme);
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

    protected function looksLikeUrl($value)
    {
        return is_string($value) && preg_match('/^https?:\/\//i', $value) === 1;
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
