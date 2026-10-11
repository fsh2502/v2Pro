<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\App;

class Language
{
    public function handle($request, Closure $next)
    {
        $locale = $request->header('content-language');
        if (in_array($locale, ['vi-VN', 'en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'fa-IR'], true)) {
            App::setLocale($locale);
        }
        return $next($request);
    }
}
