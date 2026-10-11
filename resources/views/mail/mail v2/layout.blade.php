@php
    $site = \App\Services\MailTemplateService::siteUrl($url ?? null);
    $support = \App\Services\MailTemplateService::route($site, 'support');
    $primary = \App\Services\MailTemplateService::safeHttpUrl($action_url ?? null)
        ?? \App\Services\MailTemplateService::route($site, $action_route ?? 'profile');
    $brand = (string) ($name ?? config('v2board.app_name', 'V2Board'));
    $iconName = in_array($icon ?? '', ['shield', 'calendar', 'traffic', 'message', 'lock'], true) ? $icon : 'shield';
@endphp
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>{{ $heading }} · {{ $brand }}</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; }
        table { border-collapse: separate; mso-table-lspace: 0; mso-table-rspace: 0; }
        img { border: 0; outline: none; text-decoration: none; }
        @media only screen and (max-width: 480px) {
            .mail-shell { padding: 20px 12px !important; }
            .mail-card { width: 100% !important; }
            .mail-padding { padding: 28px 22px !important; }
            .mail-heading { font-size: 28px !important; }
            .mail-code { font-size: 44px !important; letter-spacing: 5px !important; }
            .mail-brand { font-size: 16px !important; }
        }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#eaf3fb;color:#10213f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;font-size:1px;line-height:1px;color:#eaf3fb;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{ $preheader ?? $subtitle }}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eaf3fb" style="width:100%;background-color:#eaf3fb;">
        <tr><td class="mail-shell" align="center" style="padding:40px 16px;">
            <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
            <table role="presentation" class="mail-card" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3edf7;border-radius:24px;">
                <tr><td class="mail-padding" style="padding:32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            @if($site)
                            <td width="56" valign="middle"><img src="{{ $site }}/assets/mail-v2/brand.png" width="48" height="48" alt="" style="display:block;width:48px;height:48px;"></td>
                            @endif
                            <td class="mail-brand" valign="middle" style="font-size:18px;line-height:26px;font-weight:700;color:#10213f;word-break:break-word;">{{ $brand }}<br><span style="font-size:12px;line-height:20px;font-weight:400;color:#8193ad;">VPN · An toàn · Ổn định</span></td>
                        </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        @if($site)
                        <tr><td align="center" style="padding:28px 0 20px;"><img src="{{ $site }}/assets/mail-v2/{{ $iconName }}.png" width="112" height="112" alt="" style="display:block;width:112px;height:112px;"></td></tr>
                        @else
                        <tr><td style="height:28px;line-height:28px;">&nbsp;</td></tr>
                        @endif
                        <tr><td class="mail-heading" align="center" style="font-size:32px;line-height:40px;font-weight:700;letter-spacing:-0.8px;color:#10213f;">{{ $heading }}</td></tr>
                        <tr><td align="center" style="padding:12px 0 26px;font-size:16px;line-height:26px;color:#6b7d98;">{{ $subtitle }}</td></tr>
                        <tr><td>@yield('content')</td></tr>
                        @if($primary)
                        <tr><td style="padding-top:26px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#1686ff" style="background-color:#1686ff;border-radius:16px;">
                                <a href="{{ $primary }}" target="_blank" rel="noopener noreferrer" style="display:block;padding:17px 16px;font-size:17px;line-height:24px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:16px;">{{ $action_label }} &nbsp;→</a>
                            </td></tr></table>
                        </td></tr>
                        @endif
                        @yield('after_button')
                        <tr><td style="padding-top:28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #dce7f3;">
                                @if($site)
                                <tr><td align="center" style="padding:18px 0 12px;font-size:13px;line-height:22px;"><a href="{{ $site }}" style="color:#1686ff;text-decoration:none;">Website</a><span style="padding:0 12px;color:#9aacbf;">·</span><a href="{{ $support }}" style="color:#1686ff;text-decoration:none;">Hỗ trợ</a></td></tr>
                                @endif
                                <tr><td align="center" style="padding-top:8px;font-size:12px;line-height:20px;color:#8193ad;word-break:break-word;">{{ $brand }} · Kết nối an toàn mỗi ngày</td></tr>
                                <tr><td align="center" style="padding-top:6px;font-size:11px;line-height:18px;color:#94a4b9;">Email tự động từ hệ thống. Vui lòng không trả lời trực tiếp.</td></tr>
                            </table>
                        </td></tr>
                    </table>
                </td></tr>
            </table>
            <!--[if mso]></td></tr></table><![endif]-->
        </td></tr>
    </table>
</body>
</html>
