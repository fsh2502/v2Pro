<?php

namespace App\Providers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Services\AuthService;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        parent::boot();

        // Horizon::routeSmsNotificationsTo('15556667777');
        // Horizon::routeMailNotificationsTo('example@example.com');
        // Horizon::routeSlackNotificationsTo('slack-webhook-url', '#channel');

        // Horizon::night();
    }

    /**
     * Horizon uses the panel's JWT sessions, not Laravel's session guard.
     * Check the current database role so cached claims cannot retain access.
     *
     * @return void
     */
    protected function authorization()
    {
        Horizon::auth(function (Request $request) {
            $authorization = $request->input('auth_data') ?? $request->header('authorization');
            if (!is_string($authorization) || $authorization === '') return false;
            $identity = AuthService::decryptAuthData($authorization);
            if (!$identity) return false;
            $user = User::find($identity['id']);
            return $user && $user->is_admin && !$user->banned;
        });
    }
}
