<?php

namespace App\Services;

use Illuminate\Database\Connection;
use RuntimeException;

class DatabaseUpgradeService
{
    /** Only CREATE definitions are read. No dump data, DROP, or legacy UPDATE SQL is executed. */
    public function catalog(string $sql): array
    {
        $sql = preg_replace('/^\h*(?:--\h|#)[^\r\n]*/m', '', $sql);
        $tables = [];
        foreach ($this->split($sql, ';') as $statement) {
            if (!preg_match('/^CREATE TABLE(?: IF NOT EXISTS)? `([a-z0-9_]+)`\s*\((.*)\)\s*(ENGINE=.*)$/si', $statement, $match)) continue;
            [$all, $name, $body] = $match;
            if (isset($tables[$name])) throw new RuntimeException("Cấu trúc tham chiếu bị trùng bảng {$name}.");
            $columns = [];
            $indexes = [];
            foreach ($this->split($body, ',') as $definition) {
                if (preg_match('/^`([a-z0-9_]+)`\s+(.+)$/si', $definition, $column)) {
                    // Exclude quoted comments/defaults when checking SQL attributes.
                    $attributes = preg_replace("/'(?:[^'\\\\]|\\\\.|'')*'/s", "''", $column[2]);
                    $columns[$column[1]] = [
                        'sql' => $definition,
                        'required' => (bool) preg_match('/\bNOT NULL\b/i', $attributes),
                        'default' => (bool) preg_match('/\bDEFAULT\b/i', $attributes),
                        'auto' => (bool) preg_match('/\bAUTO_INCREMENT\b/i', $attributes),
                    ];
                } elseif (preg_match('/^(PRIMARY KEY|(?:UNIQUE )?(?:KEY|INDEX)\s+`?([a-z0-9_]+)`?)\s*\((.+)\)$/si', $definition, $index)) {
                    preg_match_all('/`([a-z0-9_]+)`/', end($index), $fields);
                    $primary = strtoupper($index[1]) === 'PRIMARY KEY';
                    if (!$fields[1]) throw new RuntimeException("Index không được hỗ trợ trong {$name}.");
                    $indexes[] = [
                        'name' => $primary ? 'primary' : strtolower($index[2]),
                        'columns' => $fields[1],
                        'unique' => $primary || str_starts_with(strtoupper($index[1]), 'UNIQUE'),
                        'primary' => $primary,
                        'sql' => $definition,
                    ];
                } else {
                    throw new RuntimeException("Định nghĩa không được hỗ trợ trong bảng {$name}.");
                }
            }
            foreach ($indexes as $index) {
                if (array_diff($index['columns'], array_keys($columns))) throw new RuntimeException("Index của {$name} tham chiếu cột không tồn tại.");
            }
            $tables[$name] = ['sql' => $statement, 'columns' => $columns, 'indexes' => $indexes];
        }
        foreach (['v2_user', 'v2_order', 'v2_plan', 'v2_staff_plan', 'v2_staff_activity_log'] as $required) {
            if (!isset($tables[$required])) throw new RuntimeException("Thiếu bảng tham chiếu {$required}.");
        }
        return $tables;
    }

    /** Build the entire plan before the first write, including checks on populated tables. */
    public function plan(Connection $db, array $catalog): array
    {
        $schema = $db->getSchemaBuilder();
        foreach (['v2_user' => ['id', 'email', 'password'], 'v2_order' => ['id'], 'v2_plan' => ['id']] as $table => $columns) {
            if (!$schema->hasTable($table) || !$schema->hasColumns($table, $columns)) {
                throw new RuntimeException("Database không phải bản v2Pro cũ hợp lệ: thiếu {$table} hoặc cột nền. Chưa thực hiện thay đổi.");
            }
        }
        // The pending Unicode migration widens encoding but fixes field sizes.
        // Check custom legacy fields before any DDL, rather than risk truncation.
        if (in_array($db->getDriverName(), ['mysql', 'mariadb'], true) &&
            (!$schema->hasTable('migrations') || !$db->table('migrations')->useWritePdo()
                ->where('migration', '2026_10_08_000001_allow_staff_unicode_text')->exists())) {
            foreach (['staff_app_name' => 'CHAR_LENGTH(`staff_app_name`) > 64',
                'remarks' => 'OCTET_LENGTH(CONVERT(`remarks` USING utf8mb4)) > 65535'] as $column => $condition) {
                if ($schema->hasColumn('v2_user', $column) && $db->table('v2_user')->useWritePdo()->whereRaw($condition)->exists()) {
                    throw new RuntimeException("Dữ liệu v2_user.{$column} vượt giới hạn migration Unicode; cần kiểm tra thủ công trước khi thay đổi.");
                }
            }
        }
        $steps = [];
        foreach ($catalog as $table => $reference) {
            if (!$schema->hasTable($table)) {
                $steps[] = ['label' => "Tạo bảng {$table}", 'sql' => $reference['sql']];
                continue;
            }
            $existing = $schema->getColumnListing($table);
            $populated = null;
            $missing = array_diff(array_keys($reference['columns']), $existing);
            foreach ($missing as $column) {
                $definition = $reference['columns'][$column];
                if ($definition['auto']) {
                    throw new RuntimeException("Thiếu cột định danh {$table}.{$column}; cần kiểm tra thủ công trước khi thay đổi.");
                }
                if ($definition['required'] && !$definition['default']) {
                    $populated ??= $db->table($table)->useWritePdo()->exists();
                    if ($populated) throw new RuntimeException("Không tự thêm {$table}.{$column}: bảng có dữ liệu nhưng cột bắt buộc không có giá trị mặc định.");
                }
                $steps[] = ['label' => "Thêm cột {$table}.{$column}", 'sql' => "ALTER TABLE `{$table}` ADD COLUMN {$definition['sql']}"];
            }
            $existingIndexes = $schema->getIndexes($table);
            foreach ($reference['indexes'] as $index) {
                foreach ($existingIndexes as $current) {
                    if ($current['columns'] === $index['columns'] && (bool) $current['unique'] === $index['unique'] && (bool) $current['primary'] === $index['primary']) continue 2;
                    if (strtolower($current['name']) === $index['name']) throw new RuntimeException("Index {$table}.{$index['name']} có cấu trúc khác; cần kiểm tra thủ công.");
                }
                if ($index['primary']) throw new RuntimeException("Thiếu khóa chính của {$table}; không tự thay đổi định danh dữ liệu.");
                if ($index['unique']) {
                    // Check duplicates without displaying any customer values.
                    // New columns require a dedicated review before adding uniqueness.
                    if (array_intersect($index['columns'], $missing)) throw new RuntimeException("Index duy nhất {$table}.{$index['name']} dùng cột mới; cần kiểm tra dữ liệu thủ công.");
                    $query = $db->table($table)->useWritePdo()->select($index['columns']);
                    foreach ($index['columns'] as $column) $query->whereNotNull($column);
                    if ($query->groupBy($index['columns'])->havingRaw('COUNT(*) > 1')->limit(1)->get()->isNotEmpty()) {
                        throw new RuntimeException("Không thể thêm index duy nhất {$table}.{$index['name']}: có dữ liệu trùng. Chưa thực hiện thay đổi.");
                    }
                }
                $steps[] = ['label' => "Thêm index {$table}.{$index['name']}", 'sql' => "ALTER TABLE `{$table}` ADD {$index['sql']}"];
            }
        }
        return $steps;
    }

    /** Split SQL only outside strings and nested parentheses. */
    private function split(string $sql, string $delimiter): array
    {
        $parts = [];
        $start = $depth = 0;
        $quote = null;
        for ($i = 0, $length = strlen($sql); $i < $length; $i++) {
            $char = $sql[$i];
            if ($quote !== null) {
                if ($char === '\\') { $i++; continue; }
                if ($char === $quote) {
                    if (($sql[$i + 1] ?? null) === $quote) { $i++; continue; }
                    $quote = null;
                }
                continue;
            }
            if (in_array($char, ["'", '"', '`'], true)) $quote = $char;
            elseif ($char === '(') $depth++;
            elseif ($char === ')') $depth--;
            elseif ($char === $delimiter && $depth === 0) {
                $parts[] = trim(substr($sql, $start, $i - $start));
                $start = $i + 1;
            }
        }
        if ($quote !== null || $depth !== 0) throw new RuntimeException('Cấu trúc SQL tham chiếu không hợp lệ.');
        $parts[] = trim(substr($sql, $start));
        return array_values(array_filter($parts, fn ($part) => $part !== ''));
    }
}
