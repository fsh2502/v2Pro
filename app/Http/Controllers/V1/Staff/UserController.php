<?php

namespace App\Http\Controllers\V1\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\UserCreate;
use App\Http\Requests\Staff\UserUpdate;
use App\Models\User;
use App\Services\AuthService;
use App\Services\StaffCustomerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    private function customers(Request $request)
    {
        return User::editableByStaff($request->user['id']);
    }

    public function summary(Request $request)
    {
        $staff = User::findOrFail($request->user['id']);
        $count = User::where('staff_owner_id', $staff->id)->count();
        return response(['data' => [
            'staff_code' => $staff->staff_code,
            'customer_count' => $count,
            'editable_customer_count' => $this->customers($request)->count(),
            'customer_limit' => (int) $staff->staff_customer_limit,
            'remaining' => max(0, (int) $staff->staff_customer_limit - $count)
        ]]);
    }

    public function logout(Request $request)
    {
        $authorization = $request->input('auth_data') ?? $request->header('authorization');
        $auth = new AuthService(User::findOrFail($request->user['id']));
        foreach ($auth->getSessions() as $id => $session) {
            if (($session['auth_data'] ?? null) === $authorization) $auth->removeSession($id);
        }
        return response(['data' => true]);
    }

    public function fetch(Request $request)
    {
        $params = $request->validate([
            'current' => 'sometimes|integer|min:1',
            'pageSize' => 'sometimes|integer|min:1|max:100',
            'search' => 'nullable|string|max:128'
        ]);
        $builder = $this->customers($request)->orderBy('id', 'DESC');
        if (!empty($params['search'])) {
            $search = $params['search'];
            $builder->where(function ($query) use ($search) {
                $query->where('email', 'like', '%' . $search . '%');
                if (ctype_digit($search)) $query->orWhere('id', (int) $search);
                if (preg_match('/^STF-\d+-KH-(\d+)$/', $search, $match)) {
                    $query->orWhere('id', (int) $match[1]);
                }
            });
        }
        $total = $builder->count();
        $users = $builder->forPage($params['current'] ?? 1, $params['pageSize'] ?? 20)->get();
        $service = new StaffCustomerService();
        foreach ($users as $user) {
            $service->customerData($user);
        }
        return response(['data' => $users, 'total' => $total]);
    }

    public function create(UserCreate $request)
    {
        $service = new StaffCustomerService();
        $user = $service->create($request->user['id'], $request->validated());
        return response(['data' => $service->customerData($user)]);
    }

    public function getUserInfoById(Request $request)
    {
        $request->validate(['id' => 'required|integer|min:1']);
        $user = $this->customers($request)->where('id', $request->input('id'))->first();
        if (!$user) abort(404, 'Khách hàng không tồn tại.');
        return response(['data' => (new StaffCustomerService())->customerData($user)]);
    }

    public function update(UserUpdate $request)
    {
        return DB::transaction(function () use ($request) {
            (new StaffCustomerService())->lockStaff($request->user['id']);
            $user = $this->customers($request)->where('id', $request->input('id'))->lockForUpdate()->first();
            if (!$user) abort(404, 'Khách hàng không tồn tại.');
            $params = $request->validated();
            unset($params['id']);
            if (User::where('email', $params['email'])->where('id', '!=', $user->id)->exists()) {
                abort(422, 'Email đã được sử dụng.');
            }
            $revokeSessions = !empty($params['password']) || !empty($params['banned']);
            if (!empty($params['password'])) {
                $params['password'] = password_hash($params['password'], PASSWORD_DEFAULT);
                $params['password_algo'] = null;
                $params['password_salt'] = null;
            } else {
                unset($params['password']);
            }
            if (array_key_exists('staff_plan_id', $params)) {
                $assignment = (new \App\Services\StaffPlanService())->assignment($request->user['id'], $params['staff_plan_id']);
                $params = array_merge($assignment, $params);
            }
            $before = \App\Services\StaffActivityService::snapshot($user);
            $user->update($params);
            \App\Services\StaffActivityService::user($user, $before, 'customer.update', isset($params['password']));
            if ($revokeSessions) (new AuthService($user))->removeAllSession();
            return response(['data' => true]);
        });
    }

}
