<?php

namespace App\Services;

use App\Jobs\SendEmailJob;
use App\Models\User;
use App\Models\Plan;
use App\Models\StaffPlan;
use App\Utils\CacheKey;
use Illuminate\Support\Facades\Cache;

class MailService
{
    public function remindTraffic (User $user)
    {
        if (!$user->remind_traffic) return;
        if (!$this->remindTrafficIsWarnValue($user->u, $user->d, $user->transfer_enable)) return;
        $flag = CacheKey::get('LAST_SEND_EMAIL_REMIND_TRAFFIC', $user->id);
        if (Cache::get($flag)) return;
        if (!Cache::put($flag, 1, 24 * 3600)) return;
        SendEmailJob::dispatch([
            'email' => $user->email,
            'subject' => __('The traffic usage in :app_name has reached 95%', [
                'app_name' => config('v2board.app_name', 'V2board')
            ]),
            'template_name' => 'remindTraffic',
            'template_value' => $this->reminderData($user)
        ]);
    }

    public function remindExpire(User $user)
    {
        if (!($user->expired_at !== NULL && ($user->expired_at - 86400) < time() && $user->expired_at > time())) return;
        SendEmailJob::dispatch([
            'email' => $user->email,
            'subject' => __('The service in :app_name is about to expire', [
               'app_name' =>  config('v2board.app_name', 'V2board')
            ]),
            'template_name' => 'remindExpire',
            'template_value' => $this->reminderData($user)
        ]);
    }

    private function reminderData(User $user): array
    {
        $planName = $user->staff_plan_id
            ? StaffPlan::where('id', $user->staff_plan_id)->value('name')
            : ($user->plan_id ? Plan::where('id', $user->plan_id)->value('name') : null);
        $used = max(0, (float) $user->u) + max(0, (float) $user->d);
        $total = max(0, (float) $user->transfer_enable);
        return [
            'name' => config('v2board.app_name', 'V2Board'),
            'url' => config('v2board.app_url'),
            'plan_name' => $planName,
            'expires_at' => $user->expired_at,
            'used_gb' => number_format($used / 1073741824, 2, '.', ','),
            'total_gb' => number_format($total / 1073741824, 2, '.', ','),
            'remaining_gb' => number_format(max(0, $total - $used) / 1073741824, 2, '.', ','),
            'usage_percent' => $total > 0 ? min(100, round($used / $total * 100, 1)) : 0,
            // Private Staff plans are renewed through support rather than the public catalog.
            'renew_route' => $user->staff_plan_id ? 'support' : 'plans',
        ];
    }

    private function remindTrafficIsWarnValue($u, $d, $transfer_enable)
    {
        $ud = $u + $d;
        if (!$ud) return false;
        if (!$transfer_enable) return false;
        $percentage = ($ud / $transfer_enable) * 100;
        if ($percentage < 95) return false;
        if ($percentage >= 100) return false;
        return true;
    }
}
