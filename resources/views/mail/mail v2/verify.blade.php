@extends('mail.mail v2.layout')
@php
    $heading = 'Xác minh tài khoản';
    $subtitle = 'Sử dụng mã bên dưới để hoàn tất xác minh.';
    $preheader = 'Mã xác minh của bạn có hiệu lực trong 5 phút.';
    $icon = 'shield';
    $action_label = 'Truy cập tài khoản';
    $action_route = 'profile';
@endphp
@section('content')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td class="mail-code" align="center" bgcolor="#edf6ff" style="padding:22px 12px;background-color:#edf6ff;border-radius:18px;color:#0874f9;font-size:56px;line-height:68px;font-weight:700;letter-spacing:8px;font-variant-numeric:tabular-nums;">{{ $code }}</td></tr>
    <tr><td align="center" style="padding-top:16px;font-size:13px;line-height:22px;color:#8193ad;">Mã có hiệu lực trong 5 phút.</td></tr>
    <tr><td align="center" style="padding-top:6px;font-size:13px;line-height:22px;color:#8193ad;">Không chia sẻ mã này với bất kỳ ai.</td></tr>
</table>
@endsection
