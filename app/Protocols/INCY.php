<?php

namespace App\Protocols;

use App\Utils\Helper;

class Incy
{
    public $flag = 'incy';

    private $servers;
    private $user;
    private $skipped = [];

    public function __construct($user, $servers)
    {
        $this->user = $user;
        $this->servers = $servers;
    }

    public function handle()
    {
        $configs = [];

        foreach ($this->servers as $server) {
            $config = $this->buildConfig($server);
            if ($config) {
                $configs[] = $config;
            }
        }

        $user = $this->user;
        $appName = config('v2board.app_name', 'V2Board');
        $profileTitle = base64_encode("{$appName} INCY\nOptimized full-config export");

        $response = response(json_encode($configs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200)
            ->header('Content-Type', 'application/json')
            ->header('subscription-userinfo', "upload={$user['u']}; download={$user['d']}; total={$user['transfer_enable']}; expire={$user['expired_at']}")
            ->header('profile-update-interval', '2')
            ->header('profile-title', "base64:{$profileTitle}")
            ->header('content-disposition', 'attachment; filename="' . $appName . '-incy.json"');

        $webPageUrl = (string) config('v2board.app_url', '');
        if (!empty($webPageUrl)) {
            $response->header('profile-web-page-url', $webPageUrl);
            $response->header('support-url', $webPageUrl);
        }

        $customAnnounce = config('v2board.app_announce', 'Lưu ý không được quên bật ứng dụng trước khi dùng mạng, không bật chế độ tiết kiệm pin. Khi mạng bị giật lag, xin hãy chọn máy chủ khác.');
        $skipNotice = $this->buildSkipNotice();
        $announce = !empty($customAnnounce) ? $customAnnounce : $skipNotice;
        if (!empty($announce)) {
            $response->header('announce', "base64:" . base64_encode($announce));
        }

        return $response;
    }

    private function buildConfig(array $server)
    {
        $protocol = $this->resolveProtocol($server);

        switch ($protocol) {
            case 'vless':
                $outbound = $this->buildVlessOutbound($server);
                break;
            case 'vmess':
                $outbound = $this->buildVmessOutbound($server);
                break;
            case 'trojan':
                $outbound = $this->buildTrojanOutbound($server);
                break;
            case 'shadowsocks':
                $outbound = $this->buildShadowsocksOutbound($server);
                break;
            case 'hysteria2':
                $outbound = $this->buildHysteria2Outbound($server);
                break;
            default:
                $this->skipServer($server, $protocol ?: 'unknown');
                return null;
        }

        if (!$outbound) {
            return null;
        }

        $config = [
            'log' => [
                'loglevel' => 'warning'
            ],
            'inbounds' => [
                [
                    'tag' => 'socks-in',
                    'protocol' => 'socks',
                    'port' => 10808,
                    'listen' => '127.0.0.1',
                    'settings' => [
                        'udp' => true
                    ]
                ],
                [
                    'tag' => 'http-in',
                    'protocol' => 'http',
                    'port' => 10809,
                    'listen' => '127.0.0.1'
                ]
            ],
            'outbounds' => [
                $outbound,
                [
                    'tag' => 'direct',
                    'protocol' => 'freedom',
                    'settings' => (object) []
                ],
                [
                    'tag' => 'block',
                    'protocol' => 'blackhole',
                    'settings' => (object) []
                ]
            ],
            'routing' => [
                'domainStrategy' => 'AsIs'
            ]
        ];

        $serverDescription = $this->buildServerDescription($server);
        if (!empty($serverDescription)) {
            $config['meta'] = [
                'serverDescription' => $serverDescription
            ];
        }

        return $config;
    }

    private function resolveProtocol(array $server): string
    {
        $type = $server['type'] ?? '';
        if ($type === 'v2node') {
            $type = $server['protocol'] ?? '';
        }

        $type = strtolower((string) $type);
        if ($type === 'hysteria' && (int) ($server['version'] ?? 1) === 2) {
            return 'hysteria2';
        }

        return $type;
    }

    private function buildVlessOutbound(array $server): array
    {
        $user = [
            'id' => $this->user['uuid'],
            'encryption' => $this->resolveVlessEncryption($server)
        ];

        if (!empty($server['flow'])) {
            $user['flow'] = $server['flow'];
        }

        $outbound = [
            'tag' => $server['name'],
            'protocol' => 'vless',
            'settings' => [
                'vnext' => [
                    [
                        'address' => $server['host'],
                        'port' => $this->firstPort($server['port']),
                        'users' => [$user]
                    ]
                ]
            ]
        ];

        $streamSettings = $this->buildStreamSettings($server, true);
        if (!empty($streamSettings)) {
            $outbound['streamSettings'] = $streamSettings;
        }

        return $outbound;
    }

    private function buildVmessOutbound(array $server): array
    {
        $user = [
            'id' => $this->user['uuid'],
            'alterId' => 0,
            'security' => $server['scy'] ?? 'auto'
        ];

        $outbound = [
            'tag' => $server['name'],
            'protocol' => 'vmess',
            'settings' => [
                'vnext' => [
                    [
                        'address' => $server['host'],
                        'port' => $this->firstPort($server['port']),
                        'users' => [$user]
                    ]
                ]
            ]
        ];

        $streamSettings = $this->buildStreamSettings($server, false);
        if (!empty($streamSettings)) {
            $outbound['streamSettings'] = $streamSettings;
        }

        return $outbound;
    }

    private function buildTrojanOutbound(array $server): array
    {
        $outbound = [
            'tag' => $server['name'],
            'protocol' => 'trojan',
            'settings' => [
                'servers' => [
                    [
                        'address' => $server['host'],
                        'port' => $this->firstPort($server['port']),
                        'password' => $this->user['uuid']
                    ]
                ]
            ]
        ];

        $streamSettings = $this->buildStreamSettings($server, false, true);
        if (!empty($streamSettings)) {
            $outbound['streamSettings'] = $streamSettings;
        }

        return $outbound;
    }

    private function buildShadowsocksOutbound(array $server)
    {
        if (($server['obfs'] ?? null) === 'http') {
            $this->skipServer($server, 'shadowsocks-obfs');
            return null;
        }

        if ((($server['network'] ?? null) === 'http') && isset($server['network_settings']['Host'])) {
            $this->skipServer($server, 'shadowsocks-plugin');
            return null;
        }

        $cipher = $server['cipher'];
        if (strpos($cipher, '2022-blake3') !== false) {
            $length = $cipher === '2022-blake3-aes-128-gcm' ? 16 : 32;
            $serverKey = Helper::getServerKey($server['created_at'], $length);
            $userKey = Helper::uuidToBase64($this->user['uuid'], $length);
            $password = "{$serverKey}:{$userKey}";
        } else {
            $password = $this->user['uuid'];
        }

        return [
            'tag' => $server['name'],
            'protocol' => 'shadowsocks',
            'settings' => [
                'servers' => [
                    [
                        'address' => $server['host'],
                        'port' => $this->firstPort($server['port']),
                        'method' => $cipher,
                        'password' => $password
                    ]
                ]
            ]
        ];
    }

    private function buildHysteria2Outbound(array $server)
    {
        if ((int) ($server['version'] ?? 1) !== 2) {
            $this->skipServer($server, 'hysteria1');
            return null;
        }

        if (!empty($server['obfs'])) {
            $this->skipServer($server, 'hysteria2-obfs');
            return null;
        }

        $upMbps = $server['up_mbps'] ?? null;
        $downMbps = $server['down_mbps'] ?? null;
        if (!empty($this->user['speed_limit'])) {
            if (!is_null($upMbps)) {
                $upMbps = min((int) $upMbps, (int) $this->user['speed_limit']);
            }
            if (!is_null($downMbps)) {
                $downMbps = min((int) $downMbps, (int) $this->user['speed_limit']);
            }
        }

        $tlsSettings = [
            'serverName' => $server['server_name'] ?? '',
            'allowInsecure' => !empty($server['insecure']),
            'alpn' => ['h3']
        ];

        return [
            'tag' => $server['name'],
            'protocol' => 'hysteria',
            'settings' => [
                'address' => $server['host'],
                'port' => $this->firstPort($server['port']),
                'version' => 2
            ],
            'streamSettings' => [
                'network' => 'hysteria',
                'security' => 'tls',
                'tlsSettings' => $this->removeEmpty($tlsSettings),
                'hysteriaSettings' => $this->removeEmpty([
                    'version' => 2,
                    'auth' => $this->user['uuid'],
                    'up' => is_null($upMbps) ? null : "{$upMbps} Mbps",
                    'down' => is_null($downMbps) ? null : "{$downMbps} Mbps"
                ])
            ]
        ];
    }

    private function buildStreamSettings(array $server, bool $supportsReality, bool $forceTls = false): array
    {
        $network = strtolower((string) ($server['network'] ?? 'tcp'));
        if (empty($network)) {
            $network = 'tcp';
        }

        $settings = [
            'network' => $network
        ];

        $tlsSettings = $this->extractTlsSettings($server);
        $tlsMode = (int) ($server['tls'] ?? 0);

        if ($supportsReality && $tlsMode === 2) {
            $settings['security'] = 'reality';
            $settings['realitySettings'] = $this->removeEmpty([
                'show' => false,
                'serverName' => $tlsSettings['serverName'] ?? null,
                'fingerprint' => $tlsSettings['fingerprint'] ?? 'chrome',
                'publicKey' => $tlsSettings['publicKey'] ?? null,
                'shortId' => $tlsSettings['shortId'] ?? null,
                'spiderX' => $tlsSettings['spiderX'] ?? '/'
            ]);
        } elseif ($forceTls || $tlsMode !== 0) {
            $settings['security'] = 'tls';
            $tlsConfig = $this->removeEmpty([
                'serverName' => $tlsSettings['serverName'] ?? null,
                'allowInsecure' => $tlsSettings['allowInsecure'] ?? false,
                'fingerprint' => $tlsSettings['fingerprint'] ?? null,
                'alpn' => $tlsSettings['alpn'] ?? null
            ]);
            if (!empty($tlsConfig)) {
                $settings['tlsSettings'] = $tlsConfig;
            }
        }

        $networkSettings = $this->extractNetworkSettings($server);
        switch ($network) {
            case 'tcp':
                $tcp = $this->buildTcpSettings($networkSettings);
                if (!empty($tcp)) {
                    $settings['tcpSettings'] = $tcp;
                }
                break;
            case 'ws':
                $ws = $this->buildWsSettings($networkSettings);
                if (!empty($ws)) {
                    $settings['wsSettings'] = $ws;
                }
                break;
            case 'grpc':
                $grpc = $this->buildGrpcSettings($networkSettings);
                if (!empty($grpc)) {
                    $settings['grpcSettings'] = $grpc;
                }
                break;
            case 'kcp':
                $kcp = $this->buildKcpSettings($networkSettings);
                if (!empty($kcp)) {
                    $settings['kcpSettings'] = $kcp;
                }
                break;
            case 'quic':
                $quic = $this->buildQuicSettings($networkSettings);
                if (!empty($quic)) {
                    $settings['quicSettings'] = $quic;
                }
                break;
            case 'httpupgrade':
                $httpupgrade = $this->buildHttpupgradeSettings($networkSettings);
                if (!empty($httpupgrade)) {
                    $settings['httpupgradeSettings'] = $httpupgrade;
                }
                break;
            case 'xhttp':
            case 'splithttp':
                $settings['network'] = 'xhttp';
                $xhttp = $this->buildXhttpSettings($networkSettings);
                if (!empty($xhttp)) {
                    $settings['xhttpSettings'] = $xhttp;
                }
                break;
        }

        return $settings;
    }

    private function buildTcpSettings(array $settings): array
    {
        $header = $settings['header'] ?? [];
        if (($header['type'] ?? '') !== 'http') {
            return [];
        }

        return [
            'header' => [
                'type' => 'http',
                'request' => [
                    'path' => $header['request']['path'] ?? ['/'],
                    'headers' => [
                        'Host' => $header['request']['headers']['Host'] ?? []
                    ]
                ]
            ]
        ];
    }

    private function buildWsSettings(array $settings): array
    {
        $ws = [
            'path' => $settings['path'] ?? '/'
        ];

        $host = $settings['headers']['Host'] ?? null;
        if (!empty($host)) {
            $ws['headers'] = ['Host' => $host];
        }

        if (isset($settings['maxEarlyData'])) {
            $ws['maxEarlyData'] = $settings['maxEarlyData'];
        }
        if (isset($settings['earlyDataHeaderName'])) {
            $ws['earlyDataHeaderName'] = $settings['earlyDataHeaderName'];
        }

        return $this->removeEmpty($ws);
    }

    private function buildGrpcSettings(array $settings): array
    {
        return $this->removeEmpty([
            'serviceName' => $settings['serviceName'] ?? null,
            'authority' => $settings['authority'] ?? null,
            'multiMode' => $settings['multiMode'] ?? null
        ]);
    }

    private function buildKcpSettings(array $settings): array
    {
        return $this->removeEmpty([
            'mtu' => $settings['mtu'] ?? null,
            'tti' => $settings['tti'] ?? null,
            'uplinkCapacity' => $settings['uplinkCapacity'] ?? null,
            'downlinkCapacity' => $settings['downlinkCapacity'] ?? null,
            'congestion' => $settings['congestion'] ?? null,
            'readBufferSize' => $settings['readBufferSize'] ?? null,
            'writeBufferSize' => $settings['writeBufferSize'] ?? null,
            'seed' => $settings['seed'] ?? null,
            'header' => isset($settings['header']) ? $settings['header'] : null
        ]);
    }

    private function buildQuicSettings(array $settings): array
    {
        return $this->removeEmpty([
            'security' => $settings['security'] ?? ($settings['quicSecurity'] ?? null),
            'key' => $settings['key'] ?? null,
            'header' => isset($settings['header']) ? $settings['header'] : null
        ]);
    }

    private function buildHttpupgradeSettings(array $settings): array
    {
        return $this->removeEmpty([
            'path' => $settings['path'] ?? null,
            'host' => $settings['host'] ?? null
        ]);
    }

    private function buildXhttpSettings(array $settings): array
    {
        return $this->removeEmpty([
            'path' => $settings['path'] ?? null,
            'host' => $settings['host'] ?? null,
            'mode' => $settings['mode'] ?? null,
            'extra' => $settings['extra'] ?? null
        ]);
    }

    private function resolveVlessEncryption(array $server): string
    {
        if (($server['encryption'] ?? '') !== 'mlkem768x25519plus') {
            return 'none';
        }

        $settings = $server['encryption_settings'] ?? [];
        $encryption = 'mlkem768x25519plus.' . ($settings['mode'] ?? 'native') . '.' . ($settings['rtt'] ?? '1rtt');
        if (!empty($settings['client_padding'])) {
            $encryption .= '.' . $settings['client_padding'];
        }
        if (isset($settings['password'])) {
            $encryption .= '.' . $settings['password'];
        }

        return $encryption;
    }

    private function extractTlsSettings(array $server): array
    {
        $tls = $server['tls_settings'] ?? ($server['tlsSettings'] ?? []);

        $alpn = $tls['alpn'] ?? null;
        if (is_string($alpn)) {
            $alpn = array_values(array_filter(array_map('trim', explode(',', $alpn))));
        }

        return $this->removeEmpty([
            'serverName' => $server['server_name'] ?? ($tls['server_name'] ?? ($tls['serverName'] ?? null)),
            'allowInsecure' => !empty($server['allow_insecure']) || !empty($server['insecure']) || !empty($tls['allow_insecure']) || !empty($tls['allowInsecure']),
            'fingerprint' => $tls['fingerprint'] ?? null,
            'alpn' => empty($alpn) ? null : $alpn,
            'publicKey' => $tls['public_key'] ?? null,
            'shortId' => $tls['short_id'] ?? null,
            'spiderX' => $tls['spider_x'] ?? null
        ]);
    }

    private function extractNetworkSettings(array $server): array
    {
        return $server['network_settings'] ?? ($server['networkSettings'] ?? []);
    }

    private function firstPort($port): int
    {
        $port = (string) $port;
        $parts = explode(',', $port);
        $first = trim($parts[0]);
        if (strpos($first, '-') !== false) {
            $range = explode('-', $first);
            return (int) trim($range[0]);
        }

        return (int) $first;
    }

    private function buildServerDescription(array $server): string
    {
        $parts = [];
        $protocol = strtoupper($this->resolveProtocol($server));
        if (!empty($protocol) && $protocol !== 'HYSTERIA2') {
            $parts[] = $protocol;
        } elseif ($protocol === 'HYSTERIA2') {
            $parts[] = 'HY2';
        }

        if (!empty($server['network'])) {
            $parts[] = strtoupper($server['network']);
        }

        if (!empty($server['tls'])) {
            $parts[] = (int) $server['tls'] === 2 ? 'REALITY' : 'TLS';
        }

        $description = implode(' ', array_slice($parts, 0, 3));
        if (strlen($description) > 30) {
            return substr($description, 0, 30);
        }

        return $description;
    }

    private function skipServer(array $server, string $reason): void
    {
        $this->skipped[$reason] = ($this->skipped[$reason] ?? 0) + 1;
    }

    private function buildSkipNotice(): string
    {
        if (empty($this->skipped)) {
            return '';
        }

        $parts = [];
        foreach ($this->skipped as $reason => $count) {
            $parts[] = "{$reason}:{$count}";
        }

        $notice = 'INCY export skipped unsupported nodes: ' . implode(', ', $parts);
        if (strlen($notice) > 200) {
            $notice = substr($notice, 0, 197) . '...';
        }

        return $notice;
    }

    private function removeEmpty(array $data): array
    {
        return array_filter($data, function ($value) {
            if (is_array($value)) {
                return !empty($value);
            }

            return !is_null($value) && $value !== '';
        });
    }
}
