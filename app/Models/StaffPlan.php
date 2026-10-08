<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffPlan extends Model
{
    protected $table = 'v2_staff_plan';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = ['enabled' => 'boolean'];
}
