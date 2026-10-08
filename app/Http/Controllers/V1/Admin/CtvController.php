<?php

namespace App\Http\Controllers\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StaffCustomerService;
use App\Services\SubscriptionNameService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CtvController extends Controller
{
    private function pagination(Request $request)
    {
        return $request->validate([
            'current' => 'sometimes|integer|min:1', 'pageSize' => 'sometimes|integer|min:1|max:100',
            'search' => 'nullable|string|max:128',
        ]);
    }

    private function search($query, $search)
    {
        if (!$search) return;
        $query->where(function ($builder) use ($search) {
            $builder->where('email', 'like', '%' . $search . '%');
            if (ctype_digit($search)) $builder->orWhere('id', (int) $search);
            if (preg_match('/^STF-(\d+)$/', $search, $match)) $builder->orWhere('id', (int) $match[1]);
            if (preg_match('/^STF-(\d+)-KH-(\d+)$/', $search, $match)) {
                $builder->orWhere(function ($customer) use ($match) {
                    $customer->where('staff_owner_id', (int) $match[1])->where('id', (int) $match[2]);
                });
            }
        });
    }

    public function fetch(Request $request)
    {
        $params = $this->pagination($request);
        $query = User::where('is_staff', 1)->where('is_admin', 0);
        $this->search($query, $params['search'] ?? null);
        $total = $query->count();
        $staff = $query->orderBy('id')->forPage($params['current'] ?? 1, $params['pageSize'] ?? 20)
            ->get(['id', 'email', 'is_staff', 'banned', 'staff_customer_limit', 'staff_app_name']);
        $ids = $staff->pluck('id');
        $counts = User::whereIn('staff_owner_id', $ids)->select('staff_owner_id', DB::raw('COUNT(*) as total'))
            ->groupBy('staff_owner_id')->pluck('total', 'staff_owner_id');
        $permissions = DB::table('v2_staff_plan_permission')->whereIn('staff_id', $ids)
            ->select('staff_id', DB::raw('COUNT(*) as total'))->groupBy('staff_id')->pluck('total', 'staff_id');
        $data = $staff->map(function ($user) use ($counts, $permissions) {
            return [
                'id' => $user->id, 'email' => $user->email, 'staff_code' => $user->staff_code,
                'banned' => (int) $user->banned, 'staff_customer_limit' => (int) $user->staff_customer_limit,
                'customer_count' => (int) ($counts[$user->id] ?? 0),
                'allowed_plan_count' => (int) ($permissions[$user->id] ?? 0),
                'staff_app_name' => $user->staff_app_name, 'app_name' => SubscriptionNameService::forStaff($user),
            ];
        });
        return response(['data' => $data, 'total' => $total], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function update(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|min:1',
            'staff_customer_limit' => 'required|integer|min:0|max:2147483647',
            'banned' => 'required|in:0,1',
            'staff_app_name' => ['present', 'nullable', 'string', 'max:64', 'not_regex:/[\p{Cc}\p{Zl}\p{Zp}]/u'],
        ]);
        $this->rejectExtra($request, array_keys($params));
        $name = $params['staff_app_name'] === null ? null : preg_replace('/^\s+|\s+$/u', '', $params['staff_app_name']);
        $params['staff_app_name'] = $name === '' ? null : $name;
        DB::transaction(function () use ($params) {
            $service = new StaffCustomerService();
            $staff = $service->lockStaff($params['id'], true);
            $values = $params; unset($values['id']);
            $service->updateByAdmin($staff, $values);
            if ($values['banned']) (new \App\Services\AuthService($staff))->removeAllSession();
        }, 3);
        return response(['data' => true]);
    }

    public function customers(Request $request)
    {
        $params = $this->pagination($request);
        $filter = $request->validate(['staff_owner_id' => 'sometimes|nullable|integer|min:1', 'unassigned' => 'sometimes|in:0,1']);
        $query = User::where('is_admin', 0)->where('is_staff', 0);
        $this->search($query, $params['search'] ?? null);
        if (!empty($filter['staff_owner_id'])) $query->where('staff_owner_id', $filter['staff_owner_id']);
        if (!empty($filter['unassigned'])) $query->whereNull('staff_owner_id');
        $total = $query->count();
        $users = $query->orderBy('id', 'DESC')->forPage($params['current'] ?? 1, $params['pageSize'] ?? 20)
            ->get(['id', 'email', 'staff_owner_id', 'staff_creator_id']);
        $data = $users->map(function ($user) {
            return ['id' => $user->id, 'email' => $user->email, 'customer_code' => $user->customer_code,
                'staff_owner_id' => $user->staff_owner_id, 'staff_creator_id' => $user->staff_creator_id,
                'owner_code' => $user->staff_owner_id ? User::staffCode($user->staff_owner_id) : null,
                'creator_code' => $user->staff_creator_id ? User::staffCode($user->staff_creator_id) : null];
        });
        return response(['data' => $data, 'total' => $total], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function assign(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|min:1', 'staff_owner_id' => 'present|nullable|integer|min:1',
            'staff_creator_id' => 'sometimes|nullable|integer|min:1',
        ]);
        $this->rejectExtra($request, array_keys($params));
        DB::transaction(function () use ($params) {
            $service = new StaffCustomerService();
            // Keep the same lock order as Staff creation: destination Staff, then customer.
            if ($params['staff_owner_id']) $service->lockStaff($params['staff_owner_id'], true);
            $user = User::where('id', $params['id'])->where('is_admin', 0)->where('is_staff', 0)->lockForUpdate()->first();
            if (!$user) abort(404, 'Khách hàng không tồn tại.');
            $values = $params; unset($values['id']);
            $service->updateByAdmin($user, $values);
        }, 3);
        return response(['data' => true]);
    }

    private function rejectExtra(Request $request, array $allowed)
    {
        if (array_diff(array_keys($request->except(['auth_data', 'user'])), $allowed)) {
            abort(422, 'Chỉ được thay đổi các thiết lập CTV trong biểu mẫu này.');
        }
    }
}
