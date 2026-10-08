<?php
namespace App\Http\Routes\V1;

use Illuminate\Contracts\Routing\Registrar;

class StaffRoute
{
    public function map(Registrar $router)
    {
        $router->group([
            'prefix' => 'staff',
            'middleware' => 'staff'
        ], function ($router) {
            // Personal settings: only this Staff account's subscription name.
            $router->get('/personalization/fetch', 'V1\\Staff\\PersonalizationController@fetch');
            $router->post('/personalization/update', 'V1\\Staff\\PersonalizationController@update');
            // User
            $router->get('/activity/fetch', 'V1\\ActivityLogController@staffFetch');
            $router->get('/plan/fetch', 'V1\\Staff\\PlanController@fetch');
            $router->post('/logout', 'V1\\Staff\\UserController@logout');
            $router->get ('/user/summary', 'V1\\Staff\\UserController@summary');
            $router->get ('/user/fetch', 'V1\\Staff\\UserController@fetch');
            $router->post('/user/create', 'V1\\Staff\\UserController@create');
            $router->post('/user/update', 'V1\\Staff\\UserController@update');
            $router->get ('/user/getUserInfoById', 'V1\\Staff\\UserController@getUserInfoById');
            $router->get('/user/getSubscription', 'V1\\Staff\\CustomerActionController@getSubscription');
            $router->post('/user/resetSecret', 'V1\\Staff\\CustomerActionController@resetSecret');
            $router->get('/user/getTrafficLog', 'V1\\Staff\\CustomerActionController@getTrafficLog');
            $router->post('/user/delUser', 'V1\\Staff\\CustomerActionController@delUser');
        });
    }
}
