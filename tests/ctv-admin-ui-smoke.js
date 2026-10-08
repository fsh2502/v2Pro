// CTV page form wiring against synthetic responses, never a live database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [], staff = { id: 12, email: 'staff@example.com', staff_code: 'STF-000012', staff_customer_limit: 2,
    customer_count: 1, allowed_plan_count: 1, banned: 0, staff_app_name: null, app_name: 'STF-000012' };
const customer = { id: 345, email: 'customer@example.com', staff_owner_id: 12, staff_creator_id: 12, creator_code: 'STF-000012' };
let reject = false;
const context = vm.createContext({ URLSearchParams, window: { settings: { secure_path: 'demo-admin' },
    localStorage: { getItem: () => 'admin-token' }, createStaffPlansComponent: () => 'staff-plans' },
    fetch: async (url, options) => {
        const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, options, body });
        if (reject) return { ok: false, json: async () => ({ message: 'Quota rejected' }) };
        if (url.endsWith('/update')) Object.assign(staff, body);
        if (url.endsWith('/assign')) Object.assign(customer, body);
        return { ok: true, json: async () => ({ data: url.includes('/activity?') ? [{ id: 1, actor_label: 'STF-000012', target_label: 'Customer', action: 'customer.update', changes: { banned: { before: 0, after: 1 } }, created_at: 1791244800 }]
            : url.includes('/fetch?') ? [staff] : url.includes('/customers?') ? [customer] : true, total: 1 }) };
    } });
class Component {
    constructor(props) { this.props = props; }
    setState(values, callback) { this.state = { ...this.state, ...values }; if (callback) callback(); }
}
const React = { Component, Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(flatten)];
vm.runInContext(fs.readFileSync('public/assets/staff/activity.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('public/assets/admin/ctv.js', 'utf8'), context);
(async () => {
    const CtvPage = context.window.createCtvComponent(React, 'admin-layout');
    const page = new CtvPage({ location: { pathname: '/ctv' } });
    page.dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
    await page.run(() => page.load());
    assert.equal(page.state.rows[0].id, 12);
    page.edit(staff); assert.equal(page.dialog.open, true);
    page.change('staff_customer_limit', '3'); page.change('staff_app_name', '  Personal CTV  ');
    await page.save({ preventDefault() {} });
    const saved = calls.find(call => call.url.endsWith('/update'));
    assert.deepEqual(saved.body, { id: 12, banned: 0, staff_customer_limit: 3, staff_app_name: 'Personal CTV' });
    assert.equal(page.dialog.open, false);
    page.edit(staff); page.change('staff_customer_limit', '0');
    const count = calls.length; await page.save({ preventDefault() {} });
    assert.equal(calls.length, count); assert.equal(page.state.error, true); assert.equal(page.dialog.open, true);
    page.dialog.close();
    page.setState({ tab: 'customers', page: 1, filterOwner: '12' }); await page.run(() => page.load());
    assert.match(calls.at(-1).url, /staff_owner_id=12/);
    page.edit(customer); page.change('staff_owner_id', ''); await page.save({ preventDefault() {} });
    const moved = calls.find(call => call.url.endsWith('/assign'));
    assert.deepEqual(moved.body, { id: 345, staff_owner_id: null });
    assert.equal(Object.hasOwn(moved.body, 'staff_creator_id'), false);
    const legacy = { ...customer, staff_creator_id: null };
    page.edit(legacy); page.change('staff_owner_id', '12'); page.change('staff_creator_id', '12');
    await page.save({ preventDefault() {} });
    assert.equal(calls.filter(call => call.url.endsWith('/assign')).at(-1).body.staff_creator_id, 12);
    page.edit(customer); reject = true; await page.save({ preventDefault() {} });
    assert.equal(page.state.message, 'Quota rejected'); assert.equal(page.dialog.open, true); assert.equal(page.state.busy, false);
    const staffPage = new CtvPage({}); staffPage.dialog = { open: false };
    staffPage.setState({ rows: [staff] });
    const nodes = flatten(staffPage.render());
    assert.ok(nodes.some(node => node.type === 'staff-plans' && node.props.catalogOnly));
    assert.ok(nodes.some(node => node.type === 'staff-plans' && node.props.staffId === 12));
    assert.ok(calls.every(call => call.options.headers.Authorization === 'admin-token' && call.options.cache === 'no-store'));
    reject = false; staffPage.setState({ tab: 'history', filterOwner: '12' }); await staffPage.load();
    assert.ok(calls.at(-1).url.includes('/ctv/activity?') && calls.at(-1).url.includes('staff_id=12'));
    const historyNodes = flatten(staffPage.render());
    assert.ok(historyNodes.some(node => node.type === 'details'));
    assert.ok(historyNodes.some(node => node.type === 'li' && node.children[0] === 'Trạng thái: Hoạt động → Đã khóa'));
    const bundle = fs.readFileSync('public/assets/admin/umi.js', 'utf8');
    const sidebar = bundle.slice(bundle.indexOf('    Bl7J:'), bundle.indexOf('    BnQZ:'));
    assert.ok(sidebar.indexOf('href: "/user"') < sidebar.indexOf('href: "/ctv"'));
    assert.ok(sidebar.indexOf('href: "/ctv"') < sidebar.indexOf('href: "/notice"'));
    const editor = bundle.slice(bundle.indexOf('    CgOb:'), bundle.indexOf('    ChCx:'));
    assert.ok(editor.includes('checked: t.is_staff'));
    assert.ok(!editor.includes('value: t.staff_customer_limit') && !editor.includes('value: t.staff_owner_id'));
    assert.ok(!editor.includes('createStaffPlansComponent'));
    assert.ok(editor.includes('delete e[field]'));
    page.componentWillUnmount(); assert.equal(page.dialog.open, false);
    console.log('CTV Admin checks passed: menu placement, moved controls, quota and name settings, scoped customer assignment, errors and authenticated requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
