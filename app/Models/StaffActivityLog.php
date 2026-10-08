<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffActivityLog extends Model
{
    protected $table = 'v2_staff_activity_log';
    public $timestamps = false;
    protected $guarded = ['id'];
    protected $casts = ['changes' => 'array'];
}
