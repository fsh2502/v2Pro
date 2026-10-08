<?php

namespace App\Http\Controllers\V1\User;

use App\Http\Controllers\Controller;
use App\Models\Notice;
use App\Models\User;
use Illuminate\Http\Request;

class NoticeController extends Controller
{
    public function fetch(Request $request)
    {
        $user = User::find($request->user['id']);
        $visible = Notice::where(function ($query) use ($user) {
            $query->whereNull('staff_owner_id');
            if ($user && $user->staff_owner_id) {
                $query->orWhere('staff_owner_id', $user->staff_owner_id);
            }
        });
        if ($request->has('id')) {
            $id = $request->input('id');
            $notice = $visible->where('id', $id)
                ->where('show', 1)
                ->first();
    
            if (!$notice) {
                return response([
                    'message' => 'Notice not found'
                ], 404);
            }
    
            return response([
                'data' => $notice
            ]);
        }
    
        $current = $request->input('current', 1);
        $pageSize = $request->input('pageSize', 5);
    
        $pageSize = min(max($pageSize, 1), 100);
    
        $model = $visible->orderBy('created_at', 'DESC')
            ->where('show', 1);
    
        $total = $model->count();
        $res = $model->forPage($current, $pageSize)->get();
    
        return response([
            'data' => $res,
            'total' => $total
        ]);
    }

}
