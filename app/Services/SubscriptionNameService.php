<?php

namespace App\Services;

use App\Models\User;

class SubscriptionNameService
{
    public static function forStaff(User $staff): string
    {
        return $staff->staff_app_name !== null && $staff->staff_app_name !== ''
            ? $staff->staff_app_name : User::staffCode($staff->id);
    }

    public static function forUser($user): string
    {
        // Resolve the current owner from the database; never alter global config.
        $staffId = !empty($user['is_staff']) && empty($user['is_admin'])
            ? ($user['id'] ?? null)
            : ($user['staff_owner_id'] ?? null);
        if ($staffId && empty($user['is_admin'])) {
            $staff = User::where('id', $staffId)->where('is_staff', 1)->where('is_admin', 0)->first();
            if ($staff) return self::forStaff($staff);
        }
        return config('v2board.app_name', 'V2Board');
    }

    public static function replacePlaceholders(array $config, string $name): array
    {
        // Replace parsed values before YAML serialization so punctuation is escaped.
        array_walk_recursive($config, function (&$value) use ($name) {
            if (is_string($value)) $value = str_replace('$app_name', $name, $value);
        });
        return $config;
    }

    public static function profileTitleHeader(string $name, bool $forceBase64 = false): string
    {
        // HTTP header readers do not consistently decode raw UTF-8. The
        // subscription clients using this helper support the base64: convention.
        if ($forceBase64 || preg_match('/[^\x20-\x7E]/', $name) || str_starts_with($name, 'base64:')) {
            return 'base64:' . base64_encode($name);
        }
        return $name;
    }

    public static function limitProfileName(string $name, int $limit): string
    {
        // Keep the client's code-point limit, but never split a flag pair,
        // variation selector, skin tone or joined emoji at the boundary.
        preg_match_all('/\X/u', $name, $matches);
        $result = '';
        $length = 0;
        foreach ($matches[0] as $cluster) {
            $length += mb_strlen($cluster, 'UTF-8');
            if ($length > $limit) break;
            $result .= $cluster;
        }
        return $result;
    }
}
