<?php
// Tắt thông báo rác
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json');
header('Cache-Control: no-store');

// Đặt múi giờ JP
date_default_timezone_set('Asia/Tokyo');

$token = $_GET['token'] ?? '';
if (!is_string($token) || $token === '' || strlen($token) > 256) {
    die(json_encode(['success' => false, 'error' => 'Thiếu token']));
}

$envPath = __DIR__ . '/../.env';
$dbHost = '127.0.0.1'; $dbPort = '3306'; $dbName = 'database_cua_ban'; $dbUser = 'database_cua_ban'; $dbPass = 'database_cua_ban';

try {
    require __DIR__ . '/../vendor/autoload.php';
    // Use the same quoting/escaping parser as Laravel's environment file.
    $values = \Dotenv\Dotenv::parse(file_get_contents($envPath));
    $dbHost = $values['DB_HOST'] ?? $dbHost;
    $dbPort = $values['DB_PORT'] ?? $dbPort;
    $dbName = $values['DB_DATABASE'] ?? $dbName;
    $dbUser = $values['DB_USERNAME'] ?? $dbUser;
    $dbPass = $values['DB_PASSWORD'] ?? $dbPass;
    $dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    $query = "SELECT u.id, u.email, u.u, u.d, u.transfer_enable, u.expired_at, COALESCE(p.name, sp.name) as plan_name
              FROM v2_user u
              LEFT JOIN v2_plan p ON u.plan_id = p.id
              LEFT JOIN v2_staff_plan sp ON u.staff_plan_id = sp.id
              WHERE u.token = :token LIMIT 1";
              
    $stmt = $pdo->prepare($query);
    $stmt->execute(['token' => $token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $gb = 1073741824;
        $usedData = round(($user['u'] + $user['d']) / $gb, 2);
        $totalData = round($user['transfer_enable'] / $gb, 2);
        $expiredAt = (int) ($user['expired_at'] ?? 0);
        $expire = $expiredAt > 0 ? date('d/m/Y H:i:s', $expiredAt) : 'Vĩnh viễn';
        $planName = $user['plan_name'] ? $user['plan_name'] : 'Chưa có gói';

        echo json_encode([
            'success' => true, 
            'id' => $user['id'], 
            'email' => $user['email'],
            'plan' => $planName,
            'used' => $usedData,
            'total' => $totalData,
            'expire' => $expire,
            'expired_at' => $expiredAt > 0 ? $expiredAt : null
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Token không tồn tại']);
    }
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Lỗi kết nối CSDL']);
}
?>
