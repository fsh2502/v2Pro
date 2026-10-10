<!doctype html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="{{ $description }}">
    <meta name="theme-color" content="#eef5fc">
    <meta name="referrer" content="same-origin">
    <title>{{ $title }}</title>
    @php
        $manifest = json_decode(file_get_contents(public_path('theme/ios-glass/assets/manifest.json')), true);
        $entry = $manifest['src/main.tsx'];
        $iosGlassBoot = ['title' => $title, 'logo' => $logo, 'description' => $description, 'config' => $theme_config];
    @endphp
    @foreach(($entry['css'] ?? []) as $css)
        <link rel="stylesheet" href="{{ asset('theme/ios-glass/assets/' . $css) }}">
    @endforeach
</head>
<body>
    <div id="root"></div>
    <noscript>Vui lòng bật JavaScript để sử dụng trang khách hàng.</noscript>
    <script>window.iosGlass = @json($iosGlassBoot);</script>
    <script type="module" src="{{ asset('theme/ios-glass/assets/' . $entry['file']) }}"></script>
</body>
</html>
