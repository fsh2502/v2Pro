<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStaffActivityLog extends Migration
{
    public function up()
    {
        if (Schema::hasTable('v2_staff_activity_log')) return;
        Schema::create('v2_staff_activity_log', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('actor_id')->nullable();
            $table->string('actor_type', 16);
            $table->string('actor_label', 64);
            $table->string('target_type', 16);
            $table->integer('target_id');
            $table->string('target_label', 255);
            $table->integer('staff_id')->nullable();
            $table->integer('creator_id')->nullable();
            $table->string('action', 32);
            $table->mediumText('changes');
            $table->integer('created_at');
            $table->index(['target_type', 'target_id', 'id']);
            $table->index(['staff_id', 'creator_id', 'id']);
            $table->index(['actor_id', 'id']);
        });
    }

    public function down() { Schema::dropIfExists('v2_staff_activity_log'); }
}
