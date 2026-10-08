<?php

namespace App\Http\Middleware;

use App\Services\AuthService;
use App\Models\User;
use Closure;

class Staff
{
    /**
     * Handle an incoming request.
     *
     * @param \Illuminate\Http\Request $request
     * @param \Closure $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        $authorization = $request->input('auth_data') ?? $request->header('authorization');
        if (!$authorization) abort(403, '未登录或登陆已过期');

        $user = AuthService::decryptAuthData($authorization);
        // Re-read permissions so revocation/ban takes effect even when JWT data is cached.
        $staff = $user ? User::find($user['id']) : null;
        if (!$staff || !$staff->is_staff || $staff->banned) abort(403, '未登录或登陆已过期');
        $user['is_staff'] = $staff->is_staff;
        $request->merge([
            'user' => $user
        ]);
        return $next($request);
    }
}
