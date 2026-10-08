<?php

namespace App\Http\Controllers\V1\Staff;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SubscriptionNameService;
use Illuminate\Http\Request;

class PersonalizationController extends Controller
{
    public function fetch(Request $request)
    {
        $staff = User::findOrFail($request->user['id']);
        return response(['data' => [
            'app_name' => SubscriptionNameService::forStaff($staff),
            'staff_code' => $staff->staff_code,
        ]]);
    }

    public function update(Request $request)
    {
        // The authenticated identity is the only update target.
        // Reject extra fields rather than accepting role/owner/global settings.
        if (array_diff(array_keys($request->except(['auth_data', 'user'])), ['app_name'])) {
            abort(422, 'Chỉ được thay đổi tên ứng dụng cá nhân.');
        }
        $params = $request->validate([
            'app_name' => ['required', 'string', 'max:64', 'not_regex:/[\p{Cc}\p{Zl}\p{Zp}]/u'],
        ], [
            'app_name.required' => 'Vui lòng nhập tên ứng dụng.',
            'app_name.max' => 'Tên ứng dụng tối đa 64 ký tự.',
            'app_name.not_regex' => 'Tên ứng dụng không được chứa xuống dòng hoặc ký tự điều khiển.',
        ]);
        $name = preg_replace('/^\s+|\s+$/u', '', $params['app_name']);
        if ($name === '') abort(422, 'Vui lòng nhập tên ứng dụng.');
        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $name) {
            $staff = (new \App\Services\StaffCustomerService())->lockStaff($request->user['id']);
            $before = \App\Services\StaffActivityService::snapshot($staff);
            $staff->staff_app_name = $name;
            $staff->save();
            \App\Services\StaffActivityService::user($staff, $before, 'staff.personalize');
            return response(['data' => ['app_name' => SubscriptionNameService::forStaff($staff), 'staff_code' => $staff->staff_code]]);
        });
    }
}
