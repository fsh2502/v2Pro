<?php

namespace App\Services;

use RuntimeException;

class EnvironmentFileService
{
    public function render(string $contents, array $values): string
    {
        foreach ($values as $key => $value) {
            if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $key) || preg_match('/[\r\n\x00]/', (string) $value)) {
                throw new RuntimeException('Tên biến hoặc giá trị cấu hình môi trường không hợp lệ.');
            }
            $quoted = '"' . str_replace(['\\', '"', '$'], ['\\\\', '\\"', '\\$'], (string) $value) . '"';
            $line = $key . '=' . $quoted;
            $pattern = '/^' . $key . '=[^\r\n]*/m';
            $contents = preg_match($pattern, $contents)
                ? preg_replace_callback($pattern, fn () => $line, $contents)
                : rtrim($contents, "\r\n") . "\n" . $line . "\n";
        }
        return $contents;
    }

    public function update(string $path, array $values): void
    {
        $contents = file_get_contents($path);
        if ($contents === false || file_put_contents($path, $this->render($contents, $values), LOCK_EX) === false) {
            throw new RuntimeException('Không thể ghi cấu hình môi trường. Kiểm tra quyền file .env.');
        }
    }
}
