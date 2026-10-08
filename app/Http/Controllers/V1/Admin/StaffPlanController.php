<?php

namespace App\Http\Controllers\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServerGroup;
use App\Models\StaffPlan;
use App\Models\User;
use App\Services\StaffCustomerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffPlanController extends Controller
{
    public function fetch(Request $request)
    {
        $params = $request->validate(['staff_id' => 'sometimes|integer|min:1']);
        return DB::transaction(function () use ($params) {
            if (isset($params['staff_id'])) (new StaffCustomerService())->lockStaff($params['staff_id'], true);
            return response(['data' => [
                'plans' => StaffPlan::orderBy('id')->get(),
                'allowed_plan_ids' => isset($params['staff_id']) ? DB::table('v2_staff_plan_permission')
                    ->where('staff_id', $params['staff_id'])->pluck('staff_plan_id') : [],
                'groups' => ServerGroup::orderBy('id')->get(['id', 'name']),
            ]], 200, ['Cache-Control' => 'private, no-store']);
        });
    }

    public function save(Request $request)
    {
        $params = $request->validate([
            'id' => 'sometimes|integer|min:1', 'name' => 'required|string|max:128',
            'group_id' => 'required|integer|min:1|exists:v2_server_group,id',
            'transfer_enable' => 'required|integer|min:1|max:9007199254740991',
            'speed_limit' => 'nullable|integer|min:0|max:2147483647',
            'device_limit' => 'nullable|integer|min:0|max:2147483647',
            'enabled' => 'required|in:0,1',
        ]);
        return DB::transaction(function () use ($params) {
            $plan = isset($params['id']) ? StaffPlan::where('id', $params['id'])->lockForUpdate()->first() : new StaffPlan();
            if (!$plan) abort(404, 'Gói Staff không tồn tại.');
            $new = !$plan->exists;
            $before = $new ? [] : \App\Services\StaffActivityService::planSnapshot($plan);
            unset($params['id']);
            $plan->fill($params)->save();
            \App\Services\StaffActivityService::record('plan', $plan->id, $plan->name . ' · ID ' . $plan->id, null, null,
                $new ? 'plan.create' : 'plan.update', \App\Services\StaffActivityService::diff($before, \App\Services\StaffActivityService::planSnapshot($plan)));
            return response(['data' => $plan]);
        });
    }

    public function assign(Request $request)
    {
        $params = $request->validate([
            'staff_id' => 'required|integer|min:1', 'plan_ids' => 'present|array|max:1000',
            'plan_ids.*' => 'required|integer|min:1|distinct',
        ]);
        return DB::transaction(function () use ($params) {
            (new StaffCustomerService())->lockStaff($params['staff_id'], true);
            $ids = $params['plan_ids'];
            if (StaffPlan::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->pluck('id')->count() !== count($ids)) {
                abort(422, 'Danh sách có gói Staff không tồn tại.');
            }
            $before = DB::table('v2_staff_plan_permission')->where('staff_id', $params['staff_id'])->pluck('staff_plan_id')->map(function ($id) { return (int) $id; })->all();
            sort($before); $after = array_map('intval', $ids); sort($after);
            DB::table('v2_staff_plan_permission')->where('staff_id', $params['staff_id'])->delete();
            foreach ($ids as $id) {
                DB::table('v2_staff_plan_permission')->insert(['staff_id' => $params['staff_id'], 'staff_plan_id' => $id]);
            }
            \App\Services\StaffActivityService::record('staff', $params['staff_id'], User::staffCode($params['staff_id']), $params['staff_id'], null,
                'staff.plans', \App\Services\StaffActivityService::diff(['allowed_plan_ids' => $before], ['allowed_plan_ids' => $after]));
            return response(['data' => true]);
        });
    }
}
