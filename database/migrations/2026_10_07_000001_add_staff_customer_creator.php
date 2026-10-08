<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddStaffCustomerCreator extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('v2_user', 'staff_creator_id')) {
            Schema::table('v2_user', function (Blueprint $table) {
                $table->integer('staff_creator_id')->nullable()->index();
            });
        }
        // Ownership alone cannot establish who created a historical customer.
        // Leave old rows unconfirmed instead of granting permissions by assumption.
    }

    public function down()
    {
        Schema::table('v2_user', function (Blueprint $table) {
            $table->dropIndex(['staff_creator_id']);
            $table->dropColumn('staff_creator_id');
        });
    }
}
