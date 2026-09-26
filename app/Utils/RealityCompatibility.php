<?php

namespace App\Utils;

final class RealityCompatibility
{
    /**
     * Xray-core 26.7.11+ defaults an omitted REALITY minClientVer to
     * 26.3.27. Hiddify and other sing-box based clients report a 1.x
     * compatibility version, so keep the server threshold explicit.
     */
    public const DEFAULT_MIN_CLIENT_VERSION = '1.0.0';

    public static function normalizeTlsSettings($settings): array
    {
        $settings = is_array($settings) ? $settings : [];

        // Accept Xray's camelCase spelling from existing/custom panel data,
        // but expose one stable snake_case field to v2node.
        if (!array_key_exists('min_client_ver', $settings)
            && array_key_exists('minClientVer', $settings)) {
            $settings['min_client_ver'] = $settings['minClientVer'];
        }
        unset($settings['minClientVer']);

        $version = trim((string) ($settings['min_client_ver'] ?? ''));
        if (!self::isValidVersion($version)) {
            $version = self::DEFAULT_MIN_CLIENT_VERSION;
        }
        $settings['min_client_ver'] = $version;

        return $settings;
    }

    private static function isValidVersion(string $version): bool
    {
        $parts = explode('.', $version);
        if (count($parts) !== 3) {
            return false;
        }

        foreach ($parts as $part) {
            if ($part === '' || !ctype_digit($part) || (int) $part > 255) {
                return false;
            }
        }

        return true;
    }
}
