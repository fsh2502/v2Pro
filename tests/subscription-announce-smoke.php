<?php
// Standalone regression checks: php tests/subscription-announce-smoke.php
require __DIR__ . '/../app/Utils/Helper.php';

function check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$user = [
    'id' => 25,
    'u' => 1073741824,
    'd' => 536870912,
    'transfer_enable' => 107374182400,
    'expired_at' => 1798761600,
];

$announce = App\Utils\Helper::buildSubscriptionAnnounce($user);
check(
    $announce === '👤 ID: 25 | 📱 Đã dùng: 1.5 GB / Tổng: 100GB | 💡 Hạn: 01/01/2027',
    'Default announce must contain user ID, used and total traffic, and expiration date'
);

$unlimited = App\Utils\Helper::buildSubscriptionAnnounce([
    'id' => 8,
    'u' => 0,
    'd' => 0,
    'transfer_enable' => 0,
    'expired_at' => null,
], "\nUnsupported nodes: 1");
check(
    $unlimited === "👤 ID: 8 | 📱 Đã dùng: 0 GB / Tổng: 0GB | 💡 Hạn: Không thời hạn\nUnsupported nodes: 1",
    'Unlimited subscription and optional suffix must be formatted correctly'
);

echo "PASS: default subscription announce formatting\n";
