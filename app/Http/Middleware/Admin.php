<?php

namespace App\Http\Middleware;

use App\Services\AuthService;
use App\Models\User;
use Closure;

class Admin
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
        if (!$user || !$user['is_admin']) abort(403, '未登录或登陆已过期');
        // Cached session metadata must not retain a revoked or banned Admin role.
        $current = User::find($user['id']);
        if (!$current || !$current->is_admin || $current->banned) abort(403, '未登录或登陆已过期');
        $user = $current->only(['id', 'email', 'is_admin', 'is_staff']);
        $request->merge([
            'user' => $user
        ]);
        return $next($request);
    }
}
