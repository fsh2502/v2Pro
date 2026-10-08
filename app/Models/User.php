<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    protected $table = 'v2_user';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $appends = ['staff_code', 'customer_code'];

    public function scopeOwnedByStaff($query, $staffId)
    {
        return $query->where('staff_owner_id', $staffId)
            ->where('is_admin', 0)->where('is_staff', 0);
    }

    public function scopeEditableByStaff($query, $staffId)
    {
        return $query->ownedByStaff($staffId)->where('staff_creator_id', $staffId);
    }

    public function getStaffCodeAttribute()
    {
        return $this->is_staff ? self::staffCode($this->id) : null;
    }

    public static function staffCode($id)
    {
        return 'STF-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }

    public function getCustomerCodeAttribute()
    {
        return $this->staff_owner_id
            ? self::staffCode($this->staff_owner_id) . '-KH-' . str_pad((string) $this->id, 6, '0', STR_PAD_LEFT)
            : null;
    }
    protected $casts = [
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp'
    ];
}
