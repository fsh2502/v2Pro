@extends('mail.mail v2.layout')
@php
    $percentage = isset($usage_percent) ? min(100, max(0, (float) $usage_percent)) : null;
    $heading = 'Lưu lượng sắp hết';
    $subtitle = $percentage !== null ? 'Bạn đã sử dụng ' . $percentage . '% lưu lượng của gói.' : 'Bạn đã sử dụng ít nhất 95% lưu lượng của gói.';
    $icon = 'traffic';
    $action_label = 'Quản lý gói dịch vụ';
    $action_route = 'profile';
@endphp
@section('content')
@if(isset($used_gb, $total_gb, $remaining_gb) && $percentage !== null)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dce7f3;border-radius:16px;">
    <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:15px;line-height:24px;color:#6b7d98;">Đã dùng</td><td align="right" style="font-size:15px;line-height:24px;font-weight:700;color:#10213f;">{{ $used_gb }} / {{ $total_gb }} GB</td></tr>
            <tr><td colspan="2" style="padding:16px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e1e9f2" style="background-color:#e1e9f2;border-radius:12px;"><tr>
                    @if($percentage > 0)<td width="{{ $percentage }}%" height="18" bgcolor="#f3a323" style="width:{{ $percentage }}%;height:18px;line-height:18px;background-color:#f3a323;border-radius:12px;">&nbsp;</td>@endif
                    @if($percentage < 100)<td width="{{ 100 - $percentage }}%" height="18" style="width:{{ 100 - $percentage }}%;height:18px;line-height:18px;">&nbsp;</td>@endif
                </tr></table>
            </td></tr>
            <tr><td colspan="2" style="font-size:13px;line-height:22px;color:#8193ad;">Còn lại {{ $remaining_gb }} GB</td></tr>
        </table>
    </td></tr>
</table>
@else
<p style="margin:0;text-align:center;font-size:14px;line-height:24px;color:#6b7d98;">Hãy kiểm tra lưu lượng còn lại trong tài khoản để duy trì kết nối.</p>
@endif
@endsection
