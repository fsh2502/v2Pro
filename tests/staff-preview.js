// Synthetic UI fixture: node tests/staff-preview.js. Never connects to the live database.
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const dictionaryContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/assets/admin/vi-VN.js'), 'utf8'), dictionaryContext);
let staffAppName = 'STF-000012';
const plans = [{ id: 101, name: 'Staff Cơ bản 100 GB', group_id: 1, transfer_enable: 100 * 1073741824, speed_limit: 50, device_limit: 2, enabled: true },
    { id: 102, name: 'Staff Nâng cao 200 GB', group_id: 1, transfer_enable: 200 * 1073741824, speed_limit: 100, device_limit: 3, enabled: true },
    { id: 103, name: 'Staff Đặc biệt 500 GB', group_id: 1, transfer_enable: 500 * 1073741824, speed_limit: null, device_limit: null, enabled: true }];
let allowedIds = [101, 102];
let activityLogs = [];
const staff = { id: 12, email: 'staff-demo@example.com', is_staff: 1, is_admin: 0, banned: 0, staff_customer_limit: 2,
    staff_code: 'STF-000012', staff_customer_count: 1, plan_id: null, transfer_enable: 0, u: 0, d: 0, balance: 0, commission_balance: 0, created_at: 1791244800,
    total_used: 0, alive_ip: 0, device_limit: null, expired_at: null, commission_type: 0, staff_app_name: null };
let users = [{ id: 345, staff_owner_id: 12, staff_creator_id: 12, customer_code: 'STF-000012-KH-000345', email: 'khach-mau@example.com', plan_id: null,
    staff_plan_id: 101, staff_plan_name: plans[0].name, expired_at: null, banned: 0, remarks: 'Khách hàng mẫu', u: 1073741824, d: 2147483648, transfer_enable: 107374182400, speed_limit: 50, created_at: 1791244800 }];
// Optional visual fixture for checking the original Admin's green/red tags.
if (process.env.STAFF_PREVIEW_EXPIRY_DEMO === '1') {
    const now = Math.floor(Date.now() / 1000);
    users[0].expired_at = now + 30 * 86400;
    users.push({ ...users[0], id: 346, customer_code: 'STF-000012-KH-000346',
        email: 'khach-het-han@example.com', expired_at: now - 86400,
        u: 55 * 1073741824, d: 55 * 1073741824, remarks: 'Khách hết hạn trong demo' });
}
// Preserve only synthetic preview data when restarting the user's demo server.
if (process.env.STAFF_PREVIEW_STATE) {
    const saved = JSON.parse(fs.readFileSync(process.env.STAFF_PREVIEW_STATE, 'utf8'));
    users = saved.users; staffAppName = saved.app_name;
    if (saved.plans) plans.splice(0, plans.length, ...saved.plans);
    if (saved.allowed_plan_ids) allowedIds = saved.allowed_plan_ids;
    if (saved.staff) Object.assign(staff, saved.staff);
    if (saved.activity_log) activityLogs = saved.activity_log;
}
const journalFields = ['email', 'remarks', 'u', 'd', 'transfer_enable', 'expired_at', 'banned', 'speed_limit', 'staff_plan_id', 'staff_owner_id', 'staff_creator_id', 'staff_app_name', 'staff_customer_limit'];
const snapshot = user => Object.fromEntries(journalFields.map(key => [key, user[key] ?? null]));
function journal(user, before, action, actorId = 12, extra = {}) {
    const after = action === 'customer.delete' ? {} : snapshot(user), changes = {};
    for (const key of journalFields) if ((before[key] ?? null) !== (after[key] ?? null)) changes[key] = { before: before[key] ?? null, after: after[key] ?? null };
    Object.assign(changes, extra);
    if (!Object.keys(changes).length) return;
    activityLogs.push({ id: Math.max(0, ...activityLogs.map(row => row.id)) + 1, actor_id: actorId, actor_type: actorId === 12 ? 'staff' : 'admin',
        actor_label: actorId === 12 ? 'STF-000012' : 'Admin #1', target_type: user.id === 12 ? 'staff' : 'customer', target_id: user.id,
        target_label: (user.staff_code || user.customer_code || 'KH-' + user.id) + ' · ' + user.email,
        staff_id: user.id === 12 ? 12 : user.staff_owner_id, creator_id: user.staff_creator_id, action, changes, created_at: Math.floor(Date.now() / 1000) });
}
function planJournal(plan, before, action) {
    const changes = {};
    for (const key of ['name', 'group_id', 'transfer_enable', 'speed_limit', 'device_limit', 'enabled']) {
        if ((before[key] ?? null) !== (plan[key] ?? null)) changes[key] = { before: before[key] ?? null, after: plan[key] ?? null };
    }
    if (!Object.keys(changes).length) return;
    activityLogs.push({ id: Math.max(0, ...activityLogs.map(row => row.id)) + 1, actor_id: 1, actor_type: 'admin', actor_label: 'Admin #1',
        target_type: 'plan', target_id: plan.id, target_label: plan.name + ' · ID ' + plan.id,
        staff_id: null, creator_id: null, action, changes, created_at: Math.floor(Date.now() / 1000) });
}
function history(url, staffOnly = false) {
    const search = url.searchParams.get('search'), staffId = Number(url.searchParams.get('staff_id'));
    const rows = activityLogs.filter(row => (!staffOnly || (row.target_type === 'staff' && row.target_id === 12)
        || (row.target_type === 'customer' && row.staff_id === 12 && row.creator_id === 12
            && (!users.some(user => user.id === row.target_id) || users.some(user => user.id === row.target_id && user.staff_owner_id === 12 && user.staff_creator_id === 12))))
        && (staffOnly || !staffId || row.staff_id === staffId || row.actor_id === staffId)
        && (!search || row.target_label.includes(search) || row.actor_label.includes(search) || String(row.target_id) === search)).reverse();
    const page = Number(url.searchParams.get('current') || 1), size = Number(url.searchParams.get('pageSize') || 20);
    return { data: rows.slice((page - 1) * size, page * size), total: rows.length };
}
function json(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/demo-dictionary') return json(res, dictionaryContext.window.zhViDictionary);
    if (url.pathname === '/admin-demo') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        let html = fs.readFileSync(path.join(root, 'resources/views/admin.blade.php'), 'utf8');
        for (const [key, value] of Object.entries({ title: 'Demo Admin', version: 'fixture', theme_sidebar: 'light', theme_header: 'dark', theme_color: 'default', background_url: '', logo: '', secure_path: 'demo-admin' })) {
            html = html.replace(new RegExp('\\{\\{\\s*\\$' + key + '\\s*\\}\\}', 'g'), value);
        }
        html = html.replace('<div id="root"></div>', '<div id="root"></div><script>var DICT_URL = "/demo-dictionary"; localStorage.setItem("authorization", "synthetic-admin-token");</script>');
        return res.end(html);
    }
    if (url.pathname === '/staff' || url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(fs.readFileSync(path.join(root, 'resources/views/staff.blade.php'), 'utf8').replaceAll('{{ $title }}', 'Demo Staff').replaceAll("{{ config('app.version') }}", 'fixture').replaceAll('{{ $theme_color }}', 'default').replaceAll("{{ $theme_sidebar === 'dark' ? 'sidebar-dark' : '' }}", '').replaceAll("{{ $theme_header === 'dark' ? 'page-header-dark' : '' }}", 'page-header-dark'));
    }
    if (['/assets/staff/staff.js', '/assets/staff/qr.js', '/assets/staff/staff.css', '/assets/staff/activity.js', '/assets/admin/qrcode.async.js', '/assets/admin/umi.css', '/assets/admin/components.chunk.css', '/assets/admin/theme/default.css',
        '/assets/admin/vendors.async.js', '/assets/admin/components.async.js', '/assets/admin/umi.js', '/assets/admin/vi-VN.js', '/assets/admin/v2b-mod.js', '/assets/admin/custom.css',
        '/assets/admin/certificate.js', '/assets/admin/qrcode.css', '/assets/admin/staff-plans.js', '/assets/admin/staff-plans.css', '/assets/admin/ctv.js', '/assets/admin/ctv.css'].includes(url.pathname) || /^\/assets\/admin\/static\/[\w.-]+\.(woff2?|ttf|eot|svg)$/.test(url.pathname)) {
        const types = { '.js': 'application/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
        const asset = path.join(root, 'public', url.pathname);
        if (!fs.existsSync(asset)) { res.writeHead(404); return res.end(); }
        res.setHeader('Content-Type', types[path.extname(url.pathname)] || 'application/octet-stream');
        return res.end(fs.readFileSync(asset));
    }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === '/api/v1/user/checkLogin' || url.pathname === '/api/v1/user/info') return json(res, { data: { id: 1, email: 'admin-demo@example.com', is_admin: 1 } });
    if (url.pathname.startsWith('/api/v1/demo-admin/')) {
        const action = url.pathname.replace('/api/v1/demo-admin/', '');
        if (action === 'ctv/activity') return json(res, history(url));
        if (action === 'ctv/fetch') {
            const row = { ...staff, app_name: staffAppName, customer_count: users.filter(user => user.staff_owner_id === 12).length, allowed_plan_count: allowedIds.length };
            const search = url.searchParams.get('search');
            const data = !search || [row.email, String(row.id), row.staff_code].some(value => value.includes(search)) ? [row] : [];
            return json(res, { data, total: data.length });
        }
        if (action === 'ctv/update') {
            const count = users.filter(user => user.staff_owner_id === 12).length;
            if (body.id !== 12 || !Number.isInteger(body.staff_customer_limit) || body.staff_customer_limit < count) return json(res, { message: 'Hạn mức không được nhỏ hơn số khách đang quản lý.' }, 422);
            const before = snapshot(staff); Object.assign(staff, body); staffAppName = body.staff_app_name || staff.staff_code;
            journal(staff, before, 'staff.update', 1);
            return json(res, { data: true });
        }
        if (action === 'ctv/customers') {
            const search = url.searchParams.get('search'), owner = url.searchParams.get('staff_owner_id');
            const data = users.filter(user => (!search || [user.email, String(user.id), user.customer_code || ''].some(value => value.includes(search)))
                && (!owner || user.staff_owner_id === Number(owner))).map(user => ({ ...user,
                    owner_code: user.staff_owner_id ? 'STF-' + String(user.staff_owner_id).padStart(6, '0') : null,
                    creator_code: user.staff_creator_id ? 'STF-' + String(user.staff_creator_id).padStart(6, '0') : null }));
            return json(res, { data, total: data.length });
        }
        if (action === 'ctv/assign') {
            const user = users.find(user => user.id === body.id);
            if (!user) return json(res, { message: 'Khách không tồn tại.' }, 404);
            if (body.staff_owner_id !== null && body.staff_owner_id !== 12) return json(res, { message: 'Bản demo chỉ có CTV ID 12.' }, 422);
            if (body.staff_owner_id && !user.staff_owner_id && users.filter(item => item.staff_owner_id === 12).length >= staff.staff_customer_limit) return json(res, { message: 'CTV đã đạt hạn mức khách hàng.' }, 422);
            const before = snapshot(user); Object.assign(user, body);
            user.customer_code = user.staff_owner_id ? 'STF-000012-KH-' + String(user.id).padStart(6, '0') : null;
            journal(user, before, 'customer.update', 1);
            return json(res, { data: true });
        }
        if (action === 'staff-plan/fetch') return json(res, { data: { plans, allowed_plan_ids: allowedIds, groups: [{ id: 1, name: 'Nhóm máy chủ Staff' }] } });
        if (action === 'staff-plan/assign') {
            const before = [...allowedIds].sort((a, b) => a - b), after = [...body.plan_ids].sort((a, b) => a - b);
            allowedIds = body.plan_ids;
            if (JSON.stringify(before) !== JSON.stringify(after)) journal(staff, snapshot(staff), 'staff.plans', 1, { allowed_plan_ids: { before, after } });
            return json(res, { data: true });
        }
        if (action === 'staff-plan/save') {
            if (!body.name || !body.group_id || body.transfer_enable < 1) return json(res, { message: 'Vui lòng nhập tên, nhóm và dung lượng hợp lệ.' }, 422);
            const plan = body.id ? plans.find(item => item.id === body.id) : { id: Math.max(...plans.map(item => item.id)) + 1 };
            const before = { ...plan };
            if (!body.id) plans.push(plan);
            Object.assign(plan, body, { enabled: !!body.enabled }); planJournal(plan, before, body.id ? 'plan.update' : 'plan.create'); return json(res, { data: plan });
        }
        if (action === 'user/fetch') return json(res, { data: [staff], total: 1 });
        if (action === 'user/getUserInfoById') return json(res, { data: staff });
        if (action === 'plan/fetch') return json(res, { data: [] });
        if (action === 'config/fetch') return json(res, { data: {} });
        return json(res, { data: [] });
    }
    const endpoint = url.pathname.replace('/api/v1/staff/', '');
    if (endpoint === 'activity/fetch') return json(res, history(url, true));
    const targetId = Number(body.id || url.searchParams.get('id'));
    const scopedUsers = users.filter(user => user.staff_owner_id === 12 && user.staff_creator_id === 12);
    const target = scopedUsers.find(user => user.id === targetId);
    if (['user/getUserInfoById', 'user/update'].includes(endpoint) && !target) return json(res, { message: 'Customer not found.' }, 404);
    if (endpoint === 'plan/fetch') return json(res, { data: plans.filter(plan => plan.enabled && allowedIds.includes(plan.id))
        .map(({ id, name, transfer_enable, speed_limit }) => ({ id, name, transfer_enable, speed_limit })) });
    if (['user/create', 'user/update'].includes(endpoint) && Object.hasOwn(body, 'staff_plan_id')) {
        const plan = plans.find(item => item.id === body.staff_plan_id && item.enabled && allowedIds.includes(item.id));
        if (body.staff_plan_id !== null && !plan) return json(res, { message: 'Gói Staff chưa được Admin cấp phép.' }, 422);
        body.staff_plan_name = plan ? plan.name : null; body.plan_id = null;
    }
    if (['user/getSubscription', 'user/resetSecret', 'user/getTrafficLog', 'user/delUser'].includes(endpoint)) {
        if (!target) return json(res, { message: 'Khách hàng không tồn tại.' }, 404);
        if (endpoint === 'user/getSubscription') return json(res, { data: { subscribe_url: 'https://demo.example.com/api/v1/client/subscribe?token=demo-' + target.id + '-' + (target.subscription_revision || 0) } });
        if (endpoint === 'user/getTrafficLog') return json(res, { data: [{ record_at: 1791244800, u: 1073741824, d: 2147483648, server_rate: 1 }], total: 1 });
        if (!body.confirm) return json(res, { message: 'Vui lòng xác nhận thao tác.' }, 422);
        if (endpoint === 'user/resetSecret') { target.subscription_revision = (target.subscription_revision || 0) + 1; journal(target, snapshot(target), 'customer.reset', 12, { subscription: { before: 'Đang sử dụng', after: 'Đã đặt lại' } }); }
        else { journal(target, snapshot(target), 'customer.delete'); users = users.filter(user => user.id !== targetId); }
        return json(res, { data: true });
    }
    if (endpoint === 'personalization/fetch') return json(res, { data: { app_name: staffAppName, staff_code: 'STF-000012' } });
    if (endpoint === 'personalization/update') { const before = snapshot(staff); staffAppName = body.app_name; staff.staff_app_name = body.app_name; journal(staff, before, 'staff.personalize'); return json(res, { data: { app_name: staffAppName, staff_code: 'STF-000012' } }); }
    if (url.pathname === '/api/v1/passport/auth/login') return json(res, { data: { is_staff: 1, auth_data: 'synthetic-staff-token' } });
    if (endpoint === 'user/summary') {
        const count = users.filter(user => user.staff_owner_id === 12).length;
        return json(res, { data: { staff_code: 'STF-000012', customer_count: count, editable_customer_count: users.filter(user => user.staff_owner_id === 12 && user.staff_creator_id === 12).length,
            customer_limit: staff.staff_customer_limit, remaining: Math.max(0, staff.staff_customer_limit - count) } });
    }
    if (endpoint === 'user/fetch') {
        const search = url.searchParams.get('search');
        const data = search ? scopedUsers.filter(user => user.email.includes(search) || (user.customer_code || '').includes(search)) : scopedUsers;
        return json(res, { data, total: data.length });
    }
    if (endpoint === 'user/getUserInfoById') return json(res, { data: target });
    if (endpoint === 'user/create') {
        if (users.filter(user => user.staff_owner_id === 12).length >= staff.staff_customer_limit) return json(res, { message: 'Staff đã đạt hạn mức khách hàng.' }, 422);
        const id = Math.max(345, ...users.map(user => user.id)) + 1; users.push({ ...body, id, staff_owner_id: 12, staff_creator_id: 12, banned: 0, created_at: Math.floor(Date.now() / 1000), customer_code: `STF-000012-KH-${String(id).padStart(6, '0')}` });
        journal(users[users.length - 1], {}, 'customer.create');
        return json(res, { data: users[users.length - 1] });
    }
    if (endpoint === 'user/update') { const before = snapshot(target); Object.assign(target, body, { id: Number(body.id) }); journal(target, before, 'customer.update'); return json(res, { data: true }); }
    if (endpoint === 'logout') return json(res, { data: true });
    res.writeHead(404); res.end();
});
module.exports = server;
if (require.main === module) {
    const port = Number(process.env.STAFF_PREVIEW_PORT || 8767);
    server.listen(port, '127.0.0.1', () => console.log('Synthetic Staff UI: http://127.0.0.1:' + port + '/staff'));
}
