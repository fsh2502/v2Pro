@extends('mail.mail v2.layout')
@php
    $heading = 'Dịch vụ sắp hết hạn';
    $subtitle = 'Gia hạn để duy trì kết nối của bạn.';
    $icon = 'calendar';
    $action_label = 'Gia hạn dịch vụ';
    $action_route = ($renew_route ?? '') === 'support' ? 'support' : 'plans';
    $expiry = !empty($expires_at) ? \Carbon\CarbonImmutable::createFromTimestamp((int) $expires_at, config('app.timezone', 'Asia/Tokyo')) : null;
    $hoursLeft = $expiry ? max(0, (int) ceil(($expiry->getTimestamp() - time()) / 3600)) : null;
@endphp
@section('content')
@if($expiry)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-bottom:20px;"><span style="display:inline-block;background-color:#fff4dc;border-radius:24px;padding:10px 20px;color:#ad5900;font-size:15px;line-height:20px;font-weight:600;">{{ $hoursLeft >= 24 ? 'Còn ' . (int) ceil($hoursLeft / 24) . ' ngày' : ($hoursLeft > 0 ? 'Còn ' . $hoursLeft . ' giờ' : 'Đã hết hạn') }}</span></td></tr>
</table>
@endif
@if(!empty($plan_name) || $expiry)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dce7f3;border-radius:16px;">
    @if(!empty($plan_name))
    <tr><td style="padding:18px 18px;font-size:14px;line-height:22px;color:#6b7d98;">Gói dịch vụ</td><td align="right" style="padding:18px;font-size:14px;line-height:22px;font-weight:600;color:#10213f;word-break:break-word;">{{ $plan_name }}</td></tr>
    @endif
    @if($expiry)
    <tr><td style="padding:18px;font-size:14px;line-height:22px;color:#6b7d98;">Ngày hết hạn</td><td align="right" style="padding:18px;font-size:14px;line-height:22px;font-weight:600;color:#10213f;">{{ $expiry->format('d/m/Y H:i') }}<br><span style="font-size:11px;font-weight:400;color:#8193ad;">{{ $expiry->format('T') }} (UTC{{ $expiry->format('P') }})</span></td></tr>
    @endif
</table>
@else
<p style="margin:0;text-align:center;font-size:14px;line-height:24px;color:#6b7d98;">Dịch vụ của bạn sẽ hết hạn trong vòng 24 giờ. Vui lòng kiểm tra tài khoản và gia hạn kịp thời.</p>
@endif
@endsection
