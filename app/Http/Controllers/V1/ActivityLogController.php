<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\StaffActivityLog;
use App\Models\User;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function adminFetch(Request $request) { return $this->fetch($request, true); }
    public function staffFetch(Request $request) { return $this->fetch($request, false); }

    private function fetch(Request $request, $admin)
    {
        $params = $request->validate([
            'current' => 'sometimes|integer|min:1', 'pageSize' => 'sometimes|integer|min:1|max:100',
            'search' => 'nullable|string|max:128', 'staff_id' => 'sometimes|integer|min:1',
        ]);
        $query = StaffActivityLog::query();
        if (!$admin) {
            $id = $request->user['id'];
            $query->where(function ($visible) use ($id) {
                $visible->where(function ($customer) use ($id) {
                    $customer->where('target_type', 'customer')->where('staff_id', $id)->where('creator_id', $id)
                        ->where(function ($current) use ($id) {
                            $current->whereIn('target_id', User::editableByStaff($id)->select('id'))
                                ->orWhereNotIn('target_id', User::select('id'));
                        });
                })->orWhere(function ($self) use ($id) {
                    $self->where('target_type', 'staff')->where('target_id', $id);
                });
            });
        } elseif (!empty($params['staff_id'])) {
            $id = $params['staff_id'];
            $query->where(function ($filter) use ($id) { $filter->where('staff_id', $id)->orWhere('actor_id', $id); });
        }
        if (!empty($params['search'])) {
            $search = $params['search'];
            $query->where(function ($filter) use ($search) {
                $filter->where('target_label', 'like', '%' . $search . '%')->orWhere('actor_label', 'like', '%' . $search . '%');
                if (ctype_digit($search)) $filter->orWhere('target_id', (int) $search);
            });
        }
        $total = $query->count();
        $data = $query->orderByDesc('id')->forPage($params['current'] ?? 1, $params['pageSize'] ?? 20)
            ->get(['id', 'actor_id', 'actor_type', 'actor_label', 'target_type', 'target_id', 'target_label', 'action', 'changes', 'created_at']);
        if (!$admin) {
            foreach ($data as $row) {
                $visible = $row->target_type === 'staff' ? ['email', 'password', 'is_staff', 'staff_customer_limit', 'staff_app_name', 'banned', 'allowed_plan_ids']
                    : ['email', 'remarks', 'u', 'd', 'transfer_enable', 'expired_at', 'banned', 'speed_limit', 'staff_plan_id',
                        'staff_owner_id', 'staff_creator_id', 'password', 'subscription'];
                $row->changes = array_intersect_key($row->changes, array_flip($visible));
            }
        }
        return response(['data' => $data, 'total' => $total], 200, ['Cache-Control' => 'private, no-store']);
    }
}
