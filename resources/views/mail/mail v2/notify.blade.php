@extends('mail.mail v2.layout')
@php
    $heading = 'Thông báo tài khoản';
    $subtitle = 'Bạn có thông báo mới từ ' . ($name ?? config('v2board.app_name', 'V2Board')) . '.';
    $icon = 'message';
    $action_label = 'Truy cập tài khoản';
    $action_route = 'profile';
@endphp
@section('content')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f9fd" style="background-color:#f6f9fd;border:1px solid #e3edf7;border-radius:16px;"><tr><td style="padding:22px;font-size:15px;line-height:26px;color:#344968;word-break:break-word;">{!! nl2br(e((string) ($content ?? ''))) !!}</td></tr></table>
@endsection
