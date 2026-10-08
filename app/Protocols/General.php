<?php

namespace App\Protocols;

use App\Utils\Helper;

class General
{
    public $flag = 'general';
    private $servers;
    private $user;

    public function __construct($user, $servers)
    {
        $this->user = $user;
        $this->servers = $servers;
    }

    public function handle()
    {
        $uri = '';

        foreach ($this->servers as $server) {
            $uri .= Helper::buildUri($this->user['uuid'], $server);
        }
        $name = \App\Services\SubscriptionNameService::forUser($this->user);
        return response(base64_encode($uri))
            ->header('profile-title', 'base64:' . base64_encode($name))
            ->header('content-disposition', "attachment; filename*=UTF-8''" . rawurlencode($name));
    }
}
