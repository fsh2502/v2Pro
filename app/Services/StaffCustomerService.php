<?php

namespace App\Services;

use App\Models\User;
use App\Utils\Helper;
use Illuminate\Support\Facades\DB;

class StaffCustomerService
{
    // Lock the Staff row before counting/inserting, so parallel requests share one quota.
    public function lockStaff($staffId, $allowBanned = false)
    {
        $staff = User::where('id', $staffId)->lockForUpdate()->first();
        if (!$staff || !$staff->is_staff || $staff->is_admin || (!$allowBanned && $staff->banned)) {
            abort(403, 'Tài khoản Staff không hoạt động.');
        }
        return $staff;
    }

    public function checkCapacity(User $staff, $additional = 1)
    {
        // A locking read also sees the latest committed rows under MySQL REPEATABLE READ.
        $count = User::where('staff_owner_id', $staff->id)->lockForUpdate()->pluck('id')->count();
        if ($count + $additional > (int) $staff->staff_customer_limit) {
            abort(422, 'Staff đã đạt hạn mức khách hàng.');
        }
    }

    public function create($staffId, array $data)
    {
        return DB::transaction(function () use ($staffId, $data) {
            $staff = $this->lockStaff($staffId);
            $this->checkCapacity($staff);
            if (User::where('email', $data['email'])->exists()) {
                abort(422, 'Email đã được sử dụng.');
            }
            $assignment = array_key_exists('staff_plan_id', $data)
                ? (new StaffPlanService())->assignment($staff->id, $data['staff_plan_id']) : [];
            $user = User::create(array_merge([
                'email' => $data['email'],
                'password' => password_hash($data['password'], PASSWORD_DEFAULT),
                'staff_owner_id' => $staff->id,
                'staff_creator_id' => $staff->id,
                'is_admin' => 0,
                'is_staff' => 0,
                'banned' => 0,
                'plan_id' => null,
                'group_id' => null,
                'transfer_enable' => $data['transfer_enable'] ?? 0,
                'u' => $data['u'] ?? 0,
                'd' => $data['d'] ?? 0,
                'speed_limit' => $data['speed_limit'] ?? null,
                'expired_at' => $data['expired_at'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'uuid' => Helper::guid(true),
                'token' => Helper::guid()
            ], $assignment, array_intersect_key($data, array_flip(['transfer_enable', 'speed_limit']))));
            StaffActivityService::user($user, [], 'customer.create', true, $staff);
            return $user;
        }, 3);
    }

    // Called only by Admin. Staff requests never accept ownership or quota fields.
    public function updateByAdmin(User $user, array $params)
    {
        return DB::transaction(function () use ($user, $params) {
            // Same lock order as customer creation: destination Staff, then customer.
            $ownerId = array_key_exists('staff_owner_id', $params)
                ? $params['staff_owner_id'] : $user->staff_owner_id;
            // Lock even an unchanged owner; another Admin may be transferring this customer.
            $owner = $ownerId ? $this->lockStaff($ownerId, true) : null;
            $current = User::where('id', $user->id)->lockForUpdate()->first();
            if (!$current) abort(404, 'Tài khoản không tồn tại.');
            if (array_key_exists('staff_creator_id', $params)
                && (int) $params['staff_creator_id'] !== (int) $current->staff_creator_id) {
                // Old rows need an explicit Admin confirmation; creation history is immutable afterwards.
                if ($current->staff_creator_id) abort(422, 'Không được thay đổi Staff đã tạo khách hàng.');
                $creator = User::find($params['staff_creator_id']);
                if (!$creator || !$creator->is_staff || $creator->is_admin) abort(422, 'Staff tạo khách hàng không hợp lệ.');
            }
            if ((!($params['is_staff'] ?? $current->is_staff) || ($params['is_admin'] ?? $current->is_admin))
                && User::where('staff_owner_id', $current->id)->exists()) {
                abort(422, 'Hãy chuyển khách hàng trước khi thay đổi vai trò của Staff.');
            }
            if (($params['is_admin'] ?? $current->is_admin) || ($params['is_staff'] ?? $current->is_staff)) {
                if ($ownerId) abort(422, 'Admin/Staff không thể là khách hàng của Staff.');
            }
            if ($owner && (int) $current->staff_owner_id !== (int) $ownerId) {
                if ($owner->banned) abort(422, 'Không thể gán khách hàng cho Staff đã khóa.');
                $this->checkCapacity($owner);
            }
            if (array_key_exists('staff_customer_limit', $params)) {
                $count = User::where('staff_owner_id', $current->id)->lockForUpdate()->pluck('id')->count();
                if ((int) $params['staff_customer_limit'] < $count) {
                    abort(422, 'Hạn mức không được nhỏ hơn số khách hàng đang quản lý.');
                }
            }
            $before = StaffActivityService::snapshot($current);
            $current->update($params);
            StaffActivityService::user($current, $before, $current->is_staff || !empty($before['is_staff']) ? 'staff.update' : 'customer.update', isset($params['password']));
            return $current;
        }, 3);
    }

    public function customerData(User $user)
    {
        $user->staff_plan_name = $user->staff_plan_id
            ? \App\Models\StaffPlan::where('id', $user->staff_plan_id)->value('name') : null;
        return $user->setVisible([
            'id', 'email', 'staff_owner_id', 'staff_creator_id', 'customer_code',
            'staff_plan_id', 'staff_plan_name', 'expired_at', 'banned', 'remarks', 'created_at', 'updated_at',
            'transfer_enable', 'u', 'd', 'speed_limit'
        ]);
    }

    public function deleteCustomer($staffId, $customerId)
    {
        return DB::transaction(function () use ($staffId, $customerId) {
            $this->lockStaff($staffId);
            $user = User::editableByStaff($staffId)->where('id', $customerId)->lockForUpdate()->first();
            if (!$user) abort(404, 'Khách hàng không tồn tại.');
            if (User::where('staff_owner_id', $user->id)->exists()) {
                abort(422, 'Tài khoản còn khách hàng phụ thuộc; cần Admin xử lý.');
            }
            $editableIds = User::editableByStaff($staffId)->select('id');
            if (User::where('invite_user_id', $user->id)->whereNotIn('id', $editableIds)->exists()) {
                abort(422, 'Khách hàng có liên kết ngoài phạm vi quản lý; cần Admin xử lý xóa.');
            }
            // Delete only records attached to this authorized customer, following
            // the existing Admin delete flow. Never update other Staff customers.
            \App\Models\Order::where('user_id', $user->id)->delete();
            \App\Models\InviteCode::where('user_id', $user->id)->delete();
            $ticketIds = \App\Models\Ticket::where('user_id', $user->id)->select('id');
            \App\Models\TicketMessage::whereIn('ticket_id', $ticketIds)->delete();
            \App\Models\Ticket::where('user_id', $user->id)->delete();
            \App\Models\StatUser::where('user_id', $user->id)->delete();
            User::editableByStaff($staffId)->where('invite_user_id', $user->id)->update(['invite_user_id' => null]);
            (new AuthService($user))->removeAllSession();
            $before = StaffActivityService::snapshot($user);
            $user->delete();
            StaffActivityService::user($user, $before, 'customer.delete', false, User::findOrFail($staffId));
        }, 3);
    }
}
