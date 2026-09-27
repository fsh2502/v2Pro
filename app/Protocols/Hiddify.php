<?php

namespace App\Protocols;

use App\Protocols\Singbox\Singbox;

/**
 * Hiddify-specific adapter for the native sing-box subscription.
 *
 * Keep this class deliberately small: Hiddify uses a sing-box core, so a
 * second share-link renderer would duplicate protocol handling and could
 * silently diverge from the sing-box configuration.
 */
class Hiddify
{
    public $flag = 'hiddify';

    private const MINIMUM_SPKI_PIN_SINGBOX_VERSION = '1.13.0';

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
        return $this->singboxRenderer()->handle();
    }

    /**
     * SPKI pins require sing-box 1.13 or newer. Hiddify receives only real
     * proxy outbounds and builds its own platform-specific TUN and routing.
     */
    protected function singboxRenderer(): Singbox
    {
        $version = (string) ($this->options['singbox_version'] ?? '');
        if ($version === '' || version_compare($version, self::MINIMUM_SPKI_PIN_SINGBOX_VERSION, '<')) {
            $version = self::MINIMUM_SPKI_PIN_SINGBOX_VERSION;
        }

        return new Singbox($this->user, $this->servers, [
            'version' => $version,
            'proxy_outbounds_only' => true,
        ]);
    }
}
