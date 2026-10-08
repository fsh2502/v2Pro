<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AllowStaffUnicodeText extends Migration
{
    public function up()
    {
        // The legacy v2_user table uses MySQL utf8 (three-byte characters).
        // Widen only the text fields used by CTV; keep all existing values.
        if (DB::connection()->getDriverName() !== 'mysql') return;
        foreach ([
            'staff_app_name' => 'varchar(64)',
            'remarks' => 'text',
        ] as $column => $type) {
            if (Schema::hasColumn('v2_user', $column)) {
                DB::statement("ALTER TABLE `v2_user` MODIFY `{$column}` {$type} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL");
            }
        }
    }

    public function down()
    {
        // Keep utf8mb4: reverting could destroy characters entered after the upgrade.
    }
}
