<?php

// Run before Composer/Artisan. Composer's mbstring polyfill does not supply mb_split.
if (!extension_loaded('mbstring') || !function_exists('mb_split')) {
    fwrite(STDERR, "DỪNG: PHP CLI cần extension mbstring thật và hàm mb_split (mbregex).\n");
    fwrite(STDERR, 'PHP: ' . PHP_BINARY . "\nINI: " . (php_ini_loaded_file() ?: '(không có)') . "\n");
    fwrite(STDERR, "Cài/bật mbstring cho đúng PHP; kiểm tra mbregex và disable_functions. Không tiếp tục migration.\n");
    exit(1);
}
if (mb_split('\\s+', 'runtime check') !== ['runtime', 'check']) {
    fwrite(STDERR, "DỪNG: mb_split không hoạt động đúng. Kiểm tra cấu hình mbregex của PHP.\n");
    exit(1);
}
echo "PHP mbstring/mbregex: PASS\n";
