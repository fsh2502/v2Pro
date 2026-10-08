<?php

namespace App\Services;

use App\Models\StaffPlan;
use Illuminate\Support\Facades\DB;

class StaffPlanService
{
    public function available($staffId)
    {
        return StaffPlan::where('enabled', 1)->whereIn('id',
            DB::table('v2_staff_plan_permission')->where('staff_id', $staffId)->select('staff_plan_id')
        )->orderBy('id')->get(['id', 'name', 'transfer_enable', 'speed_limit']);
    }

    // Caller locks the authenticated Staff before this lookup. Admin permission
    // changes use the same Staff lock, so revocation cannot race assignment.
    public function assignment($staffId, $planId)
    {
        $plan = null;
        if ($planId !== null) {
            $plan = StaffPlan::where('id', $planId)->where('enabled', 1)->lockForUpdate()->first();
            if (!$plan || !DB::table('v2_staff_plan_permission')->where('staff_id', $staffId)
                ->where('staff_plan_id', $planId)->exists()) {
                abort(422, 'Gói Staff không tồn tại hoặc chưa được Admin cấp phép.');
            }
        }
        $data = ['staff_plan_id' => $plan ? $plan->id : null, 'plan_id' => null,
            'group_id' => $plan ? $plan->group_id : null, 'device_limit' => $plan ? $plan->device_limit : null];
        if ($plan) {
            $data['transfer_enable'] = $plan->transfer_enable;
            $data['speed_limit'] = $plan->speed_limit;
        }
        return $data;
    }
}
