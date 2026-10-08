<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStaffOwnership extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('v2_user', 'staff_owner_id')) {
            Schema::table('v2_user', function (Blueprint $table) {
                $table->integer('staff_owner_id')->nullable()->index();
            });
        }
        if (!Schema::hasColumn('v2_user', 'staff_customer_limit')) {
            Schema::table('v2_user', function (Blueprint $table) {
                $table->unsignedInteger('staff_customer_limit')->default(0);
            });
        }
        if (!Schema::hasColumn('v2_notice', 'staff_owner_id')) {
            Schema::table('v2_notice', function (Blueprint $table) {
                $table->integer('staff_owner_id')->nullable()->index();
            });
        }
    }

    public function down()
    {
        Schema::table('v2_notice', function (Blueprint $table) {
            $table->dropIndex(['staff_owner_id']);
            $table->dropColumn('staff_owner_id');
        });
        Schema::table('v2_user', function (Blueprint $table) {
            $table->dropIndex(['staff_owner_id']);
            $table->dropColumn(['staff_owner_id', 'staff_customer_limit']);
        });
    }
}
