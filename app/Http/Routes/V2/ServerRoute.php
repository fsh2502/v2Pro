<?php
namespace App\Http\Routes\V2;

use Illuminate\Contracts\Routing\Registrar;

class ServerRoute
{
    public function map(Registrar $router)
    {
        $router->group([
            'prefix' => 'server'
        ], function ($router) {
            $router->post('/certificate', 'V2\\Server\\ServerController@certificate');
            $router->any('/config', function() {
                $ctrl = \App::make("\\App\\Http\\Controllers\\V2\\Server\\ServerController");
                return \App::call([$ctrl, 'config']);
            });
        });
    }
}
