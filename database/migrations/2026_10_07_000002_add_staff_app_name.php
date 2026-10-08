<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStaffAppName extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('v2_user', 'staff_app_name')) {
            Schema::table('v2_user', function (Blueprint $table) {
                $table->string('staff_app_name', 64)->nullable();
            });
        }
    }

    public function down()
    {
        Schema::table('v2_user', function (Blueprint $table) {
            $table->dropColumn('staff_app_name');
        });
    }
}
