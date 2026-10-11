<?php

namespace App\Services;

class MailTemplateService
{
    public static function safeHttpUrl($value): ?string
    {
        if (!is_string($value) || preg_match('/[\s\x00-\x1f\x7f]/u', $value)) return null;
        $parts = parse_url($value);
        if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)
            || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) return null;
        return $value;
    }

    public static function siteUrl($value = null): ?string
    {
        foreach ([$value, config('v2board.app_url'), config('app.url')] as $candidate) {
            if ($safe = self::safeHttpUrl($candidate)) return rtrim(preg_replace('/[?#].*$/', '', $safe), '/');
        }
        return null;
    }

    public static function route(?string $site, string $route): ?string
    {
        if (!$site) return null;
        $routes = config('v2board.frontend_theme') === 'ios-glass'
            ? ['plans' => 'plans', 'support' => 'support', 'profile' => 'profile']
            : ['plans' => 'plan', 'support' => 'ticket', 'profile' => 'profile'];
        return $site . '/#/' . ($routes[$route] ?? 'dashboard');
    }
}
