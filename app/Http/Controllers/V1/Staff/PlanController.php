<?php

namespace App\Http\Controllers\V1\Staff;

use App\Http\Controllers\Controller;
use App\Services\StaffPlanService;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function fetch(Request $request)
    {
        return response(['data' => (new StaffPlanService())->available($request->user['id'])], 200,
            ['Cache-Control' => 'private, no-store']);
    }
}
