<?php

namespace App\Http\Controllers\V1\Staff;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\StatUser;
use App\Services\StaffCustomerService;
use App\Utils\Helper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CustomerActionController extends Controller
{
    private function customer(Request $request, $lock = false)
    {
        $request->validate(['id' => 'required|integer|min:1']);
        $query = User::editableByStaff($request->user['id'])->where('id', $request->input('id'));
        if ($lock) $query->lockForUpdate();
        $user = $query->first();
        if (!$user) abort(404, 'Khách hàng không tồn tại.');
        return $user;
    }

    public function getSubscription(Request $request)
    {
        $user = $this->customer($request);
        return response(['data' => ['subscribe_url' => Helper::getSubscribeUrl($user->token)]])
            ->header('Cache-Control', 'private, no-store');
    }

    public function resetSecret(Request $request)
    {
        $request->validate(['confirm' => 'required|accepted']);
        return DB::transaction(function () use ($request) {
            (new StaffCustomerService())->lockStaff($request->user['id']);
            $user = $this->customer($request, true);
            $before = \App\Services\StaffActivityService::snapshot($user);
            $oldToken = $user->token;
            $user->token = Helper::guid();
            $user->uuid = Helper::guid(true);
            $user->save();
            \App\Services\StaffActivityService::user($user, $before, 'customer.reset');
            // Invalidate the one-time URL too; TOTP mappings resolve via the
            // old token and therefore no longer find this customer.
            $otp = Cache::get("otp_{$oldToken}");
            if ($otp) Cache::forget("otpn_{$otp}");
            Cache::forget("otp_{$oldToken}");
            return response(['data' => true]);
        }, 3);
    }

    public function getTrafficLog(Request $request)
    {
        $params = $request->validate([
            'current' => 'sometimes|integer|min:1', 'pageSize' => 'sometimes|integer|min:1|max:100',
        ]);
        $user = $this->customer($request);
        $query = StatUser::where('user_id', $user->id)->orderBy('record_at', 'DESC')->orderBy('id', 'DESC');
        $total = $query->count();
        return response(['data' => $query->forPage($params['current'] ?? 1, $params['pageSize'] ?? 20)
            ->get(['u', 'd', 'record_at', 'server_rate']), 'total' => $total]);
    }

    public function delUser(Request $request)
    {
        $request->validate(['id' => 'required|integer|min:1', 'confirm' => 'required|accepted']);
        (new StaffCustomerService())->deleteCustomer($request->user['id'], $request->input('id'));
        return response(['data' => true]);
    }
}
