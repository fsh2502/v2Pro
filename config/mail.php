<?php

return [
    // Keep existing MAIL_DRIVER installations working while allowing Laravel's MAIL_MAILER.
    'default' => env('MAIL_MAILER', env('MAIL_DRIVER', 'smtp')),

    'mailers' => [
        'smtp' => [
            'transport' => 'smtp',
            'url' => env('MAIL_URL'),
            'scheme' => env('MAIL_SCHEME', env('MAIL_ENCRYPTION', 'tls') === 'ssl' ? 'smtps' : null),
            'host' => env('MAIL_HOST', 'smtp.mailgun.org'),
            'port' => env('MAIL_PORT', 587),
            'username' => env('MAIL_USERNAME'),
            'password' => env('MAIL_PASSWORD'),
            'require_tls' => env('MAIL_ENCRYPTION', 'tls') === 'tls',
            'timeout' => 5,
            'local_domain' => env('MAIL_EHLO_DOMAIN'),
        ],
        'sendmail' => [
            'transport' => 'sendmail',
            'path' => env('MAIL_SENDMAIL_PATH', '/usr/sbin/sendmail -bs'),
        ],
        'log' => ['transport' => 'log', 'channel' => env('MAIL_LOG_CHANNEL')],
        'array' => ['transport' => 'array'],
        'ses' => ['transport' => 'ses'],
        'postmark' => ['transport' => 'postmark'],
        'mailgun' => ['transport' => 'mailgun'],
    ],

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
        'name' => env('MAIL_FROM_NAME', 'Example'),
    ],

    'markdown' => [
        'theme' => 'default',
        'paths' => [resource_path('views/vendor/mail')],
    ],
];
