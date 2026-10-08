<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStaffPlans extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('v2_staff_plan')) {
            Schema::create('v2_staff_plan', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name', 128);
                $table->integer('group_id');
                $table->bigInteger('transfer_enable');
                $table->integer('speed_limit')->nullable();
                $table->integer('device_limit')->nullable();
                $table->boolean('enabled')->default(true);
                $table->integer('created_at')->nullable();
                $table->integer('updated_at')->nullable();
            });
        }
        if (!Schema::hasTable('v2_staff_plan_permission')) {
            Schema::create('v2_staff_plan_permission', function (Blueprint $table) {
                $table->integer('staff_id');
                $table->integer('staff_plan_id');
                $table->primary(['staff_id', 'staff_plan_id']);
                $table->index('staff_plan_id');
            });
        }
        if (!Schema::hasColumn('v2_user', 'staff_plan_id')) {
            Schema::table('v2_user', function (Blueprint $table) {
                $table->integer('staff_plan_id')->nullable()->index();
            });
        }
    }

    public function down()
    {
        Schema::table('v2_user', function (Blueprint $table) {
            $table->dropIndex(['staff_plan_id']);
            $table->dropColumn('staff_plan_id');
        });
        Schema::dropIfExists('v2_staff_plan_permission');
        Schema::dropIfExists('v2_staff_plan');
    }
}
