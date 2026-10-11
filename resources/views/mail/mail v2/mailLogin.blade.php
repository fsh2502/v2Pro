@extends('mail.mail v2.layout')
@php
    $heading = 'Đăng nhập tài khoản';
    $subtitle = 'Truy cập tài khoản của bạn bằng liên kết bên dưới.';
    $icon = 'lock';
    $action_label = 'Đăng nhập tài khoản';
    $action_url = \App\Services\MailTemplateService::safeHttpUrl($link ?? null);
    $action_route = 'profile';
@endphp
@section('content')
<p style="margin:0;text-align:center;font-size:14px;line-height:24px;color:#6b7d98;">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Không chia sẻ liên kết đăng nhập với người khác.</p>
@endsection
@section('after_button')
@if($action_url)
<tr><td style="padding-top:18px;font-size:12px;line-height:21px;color:#8193ad;word-break:break-all;">Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:<br><a href="{{ $action_url }}" style="color:#1686ff;text-decoration:underline;">{{ $action_url }}</a></td></tr>
@endif
@endsection
