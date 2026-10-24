// Local-only UI fixtures: node tests/admin-translation-preview.js
// Uses the shipped admin assets, without a database or production credentials.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const timestamp = Math.floor(Date.now() / 1000);
const plans = [{ id: 1, name: 'Gói thử nghiệm', group_id: 1, transfer_enable: 100,
    month_price: 10000, show: 1, renew: 1, reset_traffic_method: 0, created_at: timestamp }];
const nodes = ['vless', 'trojan', 'vmess', 'shadowsocks', 'tuic', 'hysteria', 'anytls', 'v2node'].map((type, index) => ({
    id: index + 1, name: 'Nút thử nghiệm ' + type, type, protocol: 'vless',
    host: 'node.example.com', port: 443, server_port: 443, listen: '0.0.0.0',
    tls: 2, tls_settings: { server_name: 'www.example.com', fingerprint: 'chrome', public_key: '', short_id: '' },
    network: 'tcp', network_settings: {}, group_id: [1], route_id: [], tags: [], show: 1,
    rate: 1, sort: index, status: 1, alive: 1, online: 0, cipher: 'aes-128-gcm', version: 2,
    created_at: timestamp, updated_at: timestamp,
}));
const json = (res, data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/admin-demo' || url.pathname === '/login-demo') {
        let html = fs.readFileSync(path.join(root, 'resources/views/admin.blade.php'), 'utf8');
        for (const [key, value] of Object.entries({ title: 'Kiểm thử quản trị', version: 'vi-preview',
            theme_sidebar: 'light', theme_header: 'dark', theme_color: 'default', background_url: '', logo: '', secure_path: 'demo-admin' })) {
            html = html.replace(new RegExp('\\{\\{\\s*\\$' + key + '\\s*\\}\\}', 'g'), value);
        }
        const setup = url.pathname === '/login-demo'
            ? 'localStorage.removeItem("authorization");'
            : 'localStorage.setItem("authorization","local-preview-only");';
        html = html.replace('<div id="root"></div>', '<div id="root"></div><script>' + setup + '</script>');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
    }
    if (url.pathname.startsWith('/assets/admin/')) {
        const assetRoot = path.join(root, 'public/assets/admin');
        const asset = path.resolve(assetRoot, '.' + url.pathname.slice('/assets/admin'.length));
        if (!asset.startsWith(assetRoot + path.sep) || !fs.existsSync(asset) || !fs.statSync(asset).isFile()) {
            res.writeHead(404); return res.end();
        }
        const types = { '.js': 'application/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
        res.writeHead(200, { 'Content-Type': types[path.extname(asset)] || 'application/octet-stream' });
        return res.end(fs.readFileSync(asset));
    }
    if (url.pathname === '/api/v1/user/checkLogin' || url.pathname === '/api/v1/user/info') {
        return json(res, { data: { id: 1, email: 'admin@example.com', is_admin: 1 } });
    }
    if (url.pathname === '/api/v1/passport/auth/login') return json(res, { message: 'Incorrect email or password' }, 422);
    if (url.pathname.startsWith('/api/v1/demo-admin/')) {
        const action = url.pathname.slice('/api/v1/demo-admin/'.length);
        if (/\/(save|update|drop|generate)$/.test(action)) return json(res, { message: '名称不能为空', errors: { name: ['名称不能为空'] } }, 422);
        let data = [];
        if (action === 'server/manage/getNodes') data = nodes;
        if (action === 'server/group/fetch') data = [{ id: 1, name: 'Nhóm thử nghiệm' }];
        if (action === 'server/route/fetch') data = [{ id: 1, remarks: 'Định tuyến thử nghiệm', match: ['domain:example.com'], action: 'block' }];
        if (action === 'plan/fetch') data = plans;
        if (action === 'user/fetch') data = [{ id: 1, email: 'user@example.com', group_id: 1, plan_id: 1,
            u: 0, d: 0, transfer_enable: 10737418240, balance: 0, commission_balance: 0, banned: 0, created_at: timestamp }];
        if (action === 'coupon/fetch') data = [{ id: 1, name: 'Mã thử nghiệm', code: 'LOCAL-ONLY', type: 1, value: 1000, limit_use: 1, started_at: timestamp, ended_at: timestamp + 86400 }];
        if (action === 'giftcard/fetch') data = [{ id: 1, name: 'Thẻ thử nghiệm', code: 'LOCAL-ONLY', type: 2, value: 3, limit_use: 1, started_at: timestamp, ended_at: timestamp + 86400 }];
        if (action === 'config/fetch') data = { app_name: 'Trang thử nghiệm', app_url: 'https://example.com', currency: 'VND', currency_symbol: '₫' };
        if (action === 'system/getQueueStats') data = { status: false };
        if (action === 'system/getSystemStatus') data = { schedule: false, horizon: false, schedule_last_runtime: timestamp };
        if (action === 'stat/getOverride') data = { ticket_pending_total: 2, commission_pending_total: 3 };
        if (action === 'theme/getThemes') data = { themes: { default: JSON.parse(fs.readFileSync(path.join(root, 'public/theme/default/config.json'), 'utf8')) }, active: 'default' };
        if (action === 'theme/getThemeConfig') data = { theme_color: 'default', theme_sidebar: 'light', theme_header: 'dark', background_url: '', custom_html: '' };
        return json(res, { data, total: Array.isArray(data) ? data.length : 0 });
    }
    res.writeHead(404); res.end();
}).listen(Number(process.env.ADMIN_PREVIEW_PORT || 8776), '127.0.0.1', () => {
    console.log('Admin Vietnamese preview: http://127.0.0.1:' + (process.env.ADMIN_PREVIEW_PORT || 8776) + '/admin-demo');
});
