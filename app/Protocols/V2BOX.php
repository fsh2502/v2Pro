<?php

namespace App\Protocols;

use App\Utils\Helper;

class V2BOX
{
    public $flag = 'v2box';
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
        
        $uri = '';
        foreach ($this->servers as $server) {
            $uri .= Helper::buildUri($this->user['uuid'], $server);
        }
        $body = base64_encode($uri);

        
        $appName = config('v2board.app_name', 'V2Board');
        $headers = [
            // profile-title hỗ trợ base64 và nguyên bản
            'profile-title' => $this->getProfileTitle($appName),
            // subscription-userinfo
            'subscription-userinfo' => $this->getUserInfoHeader($this->user),
            // profile-update-interval
            'profile-update-interval' => $this->options['profile_update_interval'] ?? '24',
        ];

        // routing định tuyến (base64)
        if (!empty($this->options['routing'])) {
            $headers['routing'] = $this->options['routing'];
        }
        // announce thông báo
        if (!empty($this->options['announce'])) {
            $headers['announce'] = $this->getAnnounceHeader($this->options['announce']);
        }
        // announce-url liên kết thông báo
        if (!empty($this->options['announce_url'])) {
            $headers['announce-url'] = $this->options['announce_url'];
        }
        // update-always bắt buộc cập nhật subscription mỗi lần mở app
        if (!empty($this->options['update_always'])) {
            $headers['update-always'] = isset($this->options['update_always']) ? ($this->options['update_always'] ? 'true' : 'false') : 'true';
        }
        // Content-Disposition
        $headers['Content-Disposition'] = 'attachment; filename="' . $appName . '"';

        // Trả về response
        $response = response($body, 200);
        foreach ($headers as $k => $v) {
            $response->header($k, $v);
        }
        return $response;
    }

    // profile-title hỗ trợ base64 và nguyên bản
    protected function getProfileTitle($appName)
    {
        if (!empty($this->options['profile_title_base64'])) {
            return 'base64:' . base64_encode($appName);
        }
        return $appName;
    }

    // subscription-userinfo
    // V2BOX app hiển thị hạn sử dụng chênh 1 ngày 9 tiếng
    protected function getUserInfoHeader($user)
    {
        $parts = [];
        if (isset($user['u'])) $parts[] = "upload={$user['u']}";
        if (isset($user['d'])) $parts[] = "download={$user['d']}";
        if (isset($user['transfer_enable'])) $parts[] = "total={$user['transfer_enable']}";
        if (isset($user['expired_at'])) {
            $expireTimestamp = $user['expired_at'] + (24 * 60 * 60) + (9 * 60 * 60); // Cộng 1 ngày 9 tiếng
            $parts[] = "expire={$expireTimestamp}";
        }
        return implode('; ', $parts);
    }

    // announce hỗ trợ base64 và nguyên bản
    protected function getAnnounceHeader($announce)
    {
        if (isset($this->options['announce_base64']) && $this->options['announce_base64']) {
            return 'base64:' . base64_encode($announce);
        }
        return $announce;
    }
}