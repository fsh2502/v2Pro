<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class NodeAddressResolver
{
    /**
     * Resolve the dial address only. TLS/REALITY server names belong to the
     * original node settings and must never be inferred from the resolved IP.
     */
    public function resolve(string $host): string
    {
        $domain = strtolower(rtrim(trim($host), '.'));
        if (filter_var(trim($domain, '[]'), FILTER_VALIDATE_IP)
            || !filter_var($domain, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME)) {
            return $host;
        }

        $key = 'NODE_DIAL_ADDRESS_' . hash('sha256', $domain);
        try {
            $cached = Cache::get($key);
            if (is_string($cached) && filter_var($cached, FILTER_VALIDATE_IP)) {
                return $cached;
            }
        } catch (\Throwable $error) {
            // A cache outage must not prevent subscription generation.
        }

        try {
            // Prefer IPv4, matching the working IPv4 node address. The system
            // resolver also follows CNAMEs without hard-coding a public DNS.
            $addresses = @gethostbynamel($domain) ?: [];
            if (!$addresses) {
                foreach (@dns_get_record($domain, DNS_AAAA) ?: [] as $record) {
                    if (isset($record['ipv6'])) $addresses[] = $record['ipv6'];
                }
            }
            foreach ($addresses as $address) {
                if (!filter_var($address, FILTER_VALIDATE_IP)) continue;
                try {
                    Cache::put($key, $address, 60);
                } catch (\Throwable $error) {
                    // The address remains usable without a shared cache.
                }
                return $address;
            }
        } catch (\Throwable $error) {
            // Keep the original hostname if the panel cannot resolve it.
        }

        return $host;
    }
}
