<?php
// Tắt thông báo rác
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json');

// Đặt múi giờ JP
date_default_timezone_set('Asia/Tokyo');

$token = $_GET['token'] ?? '';
if (empty($token)) {
    die(json_encode(['success' => false, 'error' => 'Thiếu token']));
}

$envPath = __DIR__ . '/../.env';
$dbHost = '127.0.0.1'; $dbPort = '3306'; $dbName = 'database_cua_ban'; $dbUser = 'database_cua_ban'; $dbPass = 'database_cua_ban';

if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; 
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1], " \t\n\r\0\x0B\"'"); 
            
            if ($key === 'DB_HOST') $dbHost = $val;
            if ($key === 'DB_PORT') $dbPort = $val;
            if ($key === 'DB_DATABASE') $dbName = $val;
            if ($key === 'DB_USERNAME') $dbUser = $val;
            if ($key === 'DB_PASSWORD') $dbPass = $val;
        }
    }
}

try {
    $dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    $query = "SELECT u.id, u.email, u.u, u.d, u.transfer_enable, u.expired_at, p.name as plan_name 
              FROM v2_user u 
              LEFT JOIN v2_plan p ON u.plan_id = p.id 
              WHERE u.token = :token LIMIT 1";
              
    $stmt = $pdo->prepare($query);
    $stmt->execute(['token' => $token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $gb = 1073741824;
        $usedData = number_format(($user['u'] + $user['d']) / $gb, 2);
        $totalData = number_format($user['transfer_enable'] / $gb, 2);
        $expire = ($user['expired_at'] && $user['expired_at'] != 0) ? date('d/m/Y', $user['expired_at']) : 'Vĩnh viễn';
        $planName = $user['plan_name'] ? $user['plan_name'] : 'Chưa có gói';

        echo json_encode([
            'success' => true, 
            'id' => $user['id'], 
            'email' => $user['email'],
            'plan' => $planName,
            'used' => $usedData,
            'total' => $totalData,
            'expire' => $expire
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Token không tồn tại']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Lỗi kết nối CSDL']);
}
?>
