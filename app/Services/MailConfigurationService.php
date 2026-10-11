<?php

namespace App\Services;

use Illuminate\Support\Facades\Mail;

class MailConfigurationService
{
    public static function applyPanelSettings(): string
    {
        $mailer = config('mail.default', 'smtp');

        if (config('v2board.email_host')) {
            // Explicit array/log mailers remain usable for isolated staging tests.
            if ($mailer === 'smtp') {
                $smtp = config('mail.mailers.smtp', []);
                foreach (['host', 'port', 'username', 'password'] as $field) {
                    $smtp[$field] = config('v2board.email_' . $field, $smtp[$field] ?? null);
                }
                $encryption = config('v2board.email_encryption', 'tls');
                $smtp['url'] = null;
                $smtp['scheme'] = $encryption === 'ssl' ? 'smtps' : 'smtp';
                $smtp['require_tls'] = $encryption === 'tls';
                config(['mail.mailers.smtp' => $smtp]);
            }
            config([
                'mail.from.address' => config('v2board.email_from_address', config('mail.from.address')),
                'mail.from.name' => config('v2board.app_name', 'V2Board'),
            ]);
        }

        // Horizon retains the MailManager between jobs; discard its old transport/settings.
        Mail::purge($mailer);

        return $mailer;
    }
}
