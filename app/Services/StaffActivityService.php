<?php

namespace App\Services;

use App\Models\StaffActivityLog;
use App\Models\User;

class StaffActivityService
{
    // Only these fields may enter the journal. Credentials and financial data never do.
    public static function snapshot(User $user)
    {
        $data = [];
        foreach (['email', 'remarks', 'staff_app_name', 'u', 'd', 'transfer_enable', 'expired_at',
            'banned', 'speed_limit', 'device_limit', 'staff_plan_id', 'plan_id', 'group_id',
            'staff_owner_id', 'staff_creator_id', 'staff_customer_limit', 'is_staff', 'is_admin'] as $key) {
            $value = $user->getAttribute($key);
            $data[$key] = in_array($key, ['email', 'remarks', 'staff_app_name']) || $value === null ? $value : (int) $value;
        }
        return $data;
    }

    public static function user(User $user, array $before, $action, $passwordChanged = false, User $actor = null)
    {
        $after = $action === 'customer.delete' || $action === 'staff.delete' ? [] : self::snapshot($user);
        if (!$user->is_staff && !$user->staff_owner_id && !$user->staff_creator_id
            && empty($before['is_staff']) && empty($before['staff_owner_id']) && empty($before['staff_creator_id'])) return;
        $staff = $user->is_staff || !empty($before['is_staff']);
        $changes = self::diff($before, $after);
        if ($passwordChanged) $changes['password'] = ['before' => 'Ẩn', 'after' => 'Đã thay đổi'];
        if ($action === 'customer.reset') $changes['subscription'] = ['before' => 'Đang sử dụng', 'after' => 'Đã đặt lại'];
        self::record($staff ? 'staff' : 'customer', $user->id,
            ($staff ? User::staffCode($user->id) : ($user->customer_code ?: 'KH-' . $user->id)) . ' · ' . $user->email,
            $staff ? $user->id : $user->staff_owner_id, $staff ? null : $user->staff_creator_id,
            $action, $changes, $actor);
    }

    public static function diff(array $before, array $after)
    {
        $changes = [];
        foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $key) {
            $old = $before[$key] ?? null; $new = $after[$key] ?? null;
            if ($old !== $new) $changes[$key] = ['before' => $old, 'after' => $new];
        }
        return $changes;
    }

    public static function planSnapshot(\App\Models\StaffPlan $plan)
    {
        $data = $plan->only(['name', 'group_id', 'transfer_enable', 'speed_limit', 'device_limit', 'enabled']);
        foreach ($data as $key => $value) if ($key !== 'name' && $value !== null) $data[$key] = (int) $value;
        return $data;
    }

    public static function record($type, $id, $label, $staffId, $creatorId, $action, array $changes, User $actor = null)
    {
        if (!$changes) return; // Saving an unchanged form is not a data change.
        // Middleware replaces this identity with the authenticated session data.
        // Preserve the actor's role at action time, including self-demotion/deletion.
        $identity = request()->input('user');
        $actorId = $actor ? $actor->id : (is_array($identity) ? ($identity['id'] ?? null) : null);
        $admin = $actor ? $actor->is_admin : (is_array($identity) ? ($identity['is_admin'] ?? false) : false);
        StaffActivityLog::create([
            'actor_id' => $actorId,
            'actor_type' => $actorId ? ($admin ? 'admin' : 'staff') : 'system',
            'actor_label' => $actorId ? ($admin ? 'Admin #' . $actorId : User::staffCode($actorId)) : 'Hệ thống',
            'target_type' => $type, 'target_id' => $id, 'target_label' => $label,
            'staff_id' => $staffId, 'creator_id' => $creatorId, 'action' => $action,
            'changes' => $changes, 'created_at' => time(),
        ]);
    }
}
