// Test the portal's form/API wiring with an isolated DOM and synthetic responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
    constructor(tagName = 'DIV') { this.tagName = tagName; this.children = []; this.listeners = {}; this.hidden = false; this.value = ''; this.dataset = {}; this.disabled = false; this.style = {}; this.attributes = {}; this.classList = { remove() {}, toggle() {} }; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    showModal() { this.open = true; } close() { this.open = false; if (this.listeners.close) this.listeners.close(); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    getBoundingClientRect() { return { left: 900, bottom: 400 }; }
    focus() { document.activeElement = this; } select() { this.selected = true; }
    contains(target) { return this === target || this.children.some(child => child.contains(target)); }
    reset() { for (const field of Object.values(this.elements)) field.value = ''; }
    async emit(type) { await this.listeners[type]({ preventDefault() {}, stopPropagation() {}, currentTarget: this, target: this, submitter: null }); }
}
const elements = new Map();
const element = id => { if (!elements.has(id)) { const item = new Element(); item.id = id; elements.set(id, item); } return elements.get(id); };
const forms = {
    'login-form': ['email', 'password'], 'search-form': ['search'], 'personalization-form': ['app_name'],
    'activity-search-form': ['search'],
    'customer-form': ['id', 'email', 'password', 'u', 'd', 'transfer_enable', 'staff_plan_id', 'speed_limit', 'expired_at', 'banned', 'remarks']
};
for (const [id, fields] of Object.entries(forms)) {
    const form = element(id); form.tagName = 'FORM'; form.elements = Object.fromEntries(fields.map(name => [name, new Element('INPUT')]));
}
element('customer-form').elements.staff_plan_id = element('customer-plan');
const document = {
    getElementById: element, createElement: tag => new Element(tag.toUpperCase()),
    createElementNS: (_, tag) => new Element(tag), addEventListener() {},
    querySelectorAll: selector => selector === 'dialog[open]' ? [...elements.values()].filter(item => item.open) : []
};
const plans = [{ id: 1, name: 'Staff 10 GB', transfer_enable: 10 * 1073741824, speed_limit: 50 },
    { id: 2, name: 'Staff 200 GB', transfer_enable: 200 * 1073741824, speed_limit: 100 }];
const calls = []; let customers = [{ id: 345, email: 'own@example.com', customer_code: 'STF-000012-KH-000345', staff_plan_id: 1, staff_plan_name: 'Staff 10 GB', plan_id: null, expired_at: null, banned: 0, u: 1073741825, d: 2147483648, transfer_enable: 10737418240, speed_limit: 50, created_at: 1791244800 }];
let createFailure = false, appName = 'STF-000012', personalizationFailure = false, confirmation = true;
const copied = [], confirmations = [];
const storage = new Map();
async function fetch(url, options) {
    const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, body, options });
    let data = {};
    if (url.includes('passport/auth/login')) data = { is_staff: 1, auth_data: 'test-token' };
    else if (url.includes('personalization/')) {
        if (body && personalizationFailure) return { ok: false, status: 422, json: async () => ({ message: 'Tên ứng dụng không hợp lệ.' }) };
        if (body) appName = body.app_name;
        data = { app_name: appName, staff_code: 'STF-000012' };
    }
    else if (url.includes('plan/fetch')) data = plans;
    else if (url.includes('user/summary')) data = { staff_code: 'STF-000012', customer_count: customers.length, customer_limit: 2, remaining: 2 - customers.length };
    else if (url.includes('user/fetch')) return { ok: true, json: async () => ({ data: customers, total: customers.length }) };
    else if (url.includes('user/getUserInfoById')) data = customers[0];
    else if (url.includes('user/getSubscription')) data = { subscribe_url: 'https://demo.example.com/subscribe?token=demo-345' };
    else if (url.includes('user/getTrafficLog')) return { ok: true, json: async () => ({ data: [{ u: 1073741824, d: 2147483648, record_at: 1791244800, server_rate: 1 }], total: 1 }) };
    else if (url.includes('activity/fetch')) return { ok: true, json: async () => ({ data: [{ id: 1, actor_label: 'STF-000012', target_label: 'Customer 345', action: 'customer.update', created_at: 1791244800,
        changes: { remarks: { before: null, after: '<script>unsafe()</script>' }, transfer_enable: { before: 1073741824, after: 2147483648 } } }], total: 1 }) };
    else if (url.endsWith('user/delUser')) customers = customers.filter(user => user.id !== body.id);
    else if (url.endsWith('user/resetSecret')) data = true;
    else if (url.endsWith('user/create')) {
        if (createFailure) return { ok: false, status: 422, json: async () => ({ message: 'Staff đã đạt hạn mức khách hàng.' }) };
        customers.push({ ...body, id: 346, banned: 0, customer_code: 'STF-000012-KH-000346' }); data = customers[1];
    } else if (url.endsWith('user/update')) Object.assign(customers[0], body);
    return { ok: true, status: 200, json: async () => ({ data }) };
}
const context = vm.createContext({ document, fetch, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    FormData: class { constructor(form) { this.form = form; } *[Symbol.iterator]() {
        for (const [key, field] of Object.entries(this.form.elements)) {
            if (key === 'staff_plan_id' && field.children.some(option => option.value === field.value && option.disabled)) continue;
            yield [key, field.value];
        }
    } },
    Option: class extends Element { constructor(text, value) { super('OPTION'); this.textContent = text; this.value = value; } },
    window: { webpackJsonp: [], innerWidth: 1440, innerHeight: 900, addEventListener() {} }, TextEncoder,
    navigator: { clipboard: { writeText: async text => copied.push(text) } }, confirm: text => { confirmations.push(text); return confirmation; }, URL, URLSearchParams, Date, console });
vm.runInContext(fs.readFileSync('public/assets/admin/qrcode.async.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('public/assets/staff/qr.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('public/assets/staff/activity.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('public/assets/staff/staff.js', 'utf8'), context);
(async () => {
    const login = element('login-form'); login.elements.email.value = 'staff@example.com'; login.elements.password.value = 'test-password';
    await login.emit('submit');
    for (const id of ['previous', 'next', 'new-customer', 'nav-customers', 'nav-history', 'nav-personalization']) element(id).tagName = 'BUTTON';
    // Real button events pass through task(), which must preserve the fetched bounds.
    await element('nav-customers').emit('click');
    assert.equal(element('previous').disabled, true); assert.equal(element('next').disabled, true);
    assert.equal(element('workspace').hidden, false);
    assert.equal(element('quota-staff-code').textContent, 'STF-000012');
    assert.equal(element('quota-count').textContent, '1 / 2');
    assert.equal(element('quota-fill').style.width, '50%');
    const row = element('customer-rows').children[0];
    assert.equal(row.children[2].children[0].textContent, '3.00');
    assert.equal(row.children[2].children[0].className, 'ant-tag ant-tag-green');
    assert.equal(row.children[3].textContent, '10.00');
    const joined = new Date(1791244800000), pad = value => String(value).padStart(2, '0');
    assert.equal(row.children[4].textContent, joined.getFullYear() + '/' + pad(joined.getMonth() + 1) + '/' + pad(joined.getDate()) + ' ' + pad(joined.getHours()) + ':' + pad(joined.getMinutes()));
    assert.equal(row.children[6].children[0].className, 'ant-tag ant-tag-green');
    assert.equal(row.children[6].children[0].textContent, 'Không giới hạn');
    // Exercise expiry and quota colors without altering any real account.
    customers[0].expired_at = Math.floor(Date.now() / 1000) + 86400;
    await element('search-form').emit('submit');
    assert.equal(element('customer-rows').children[0].children[6].children[0].className, 'ant-tag ant-tag-green');
    customers[0].expired_at = 1; customers[0].transfer_enable = 1073741824; customers[0].banned = 1;
    await element('search-form').emit('submit');
    const expiredRow = element('customer-rows').children[0];
    assert.equal(expiredRow.children[6].children[0].className, 'ant-tag ant-tag-red');
    assert.equal(expiredRow.children[2].children[0].className, 'ant-tag ant-tag-red');
    assert.equal(expiredRow.children[7].children[0].className, 'ant-tag ant-tag-red');
    customers[0].expired_at = null; customers[0].transfer_enable = 10737418240; customers[0].banned = 0;
    await element('search-form').emit('submit');
    assert.equal(storage.get('v2pro_staff_auth'), 'test-token');
    await element('nav-personalization').emit('click');
    assert.equal(element('personalization').hidden, false); assert.equal(element('customers').hidden, true);
    const nameInput = element('personalization-form').elements.app_name;
    nameInput.value = '  Mạng riêng của tôi  ';
    await nameInput.emit('input'); assert.equal(element('app-name-preview').textContent, 'Mạng riêng của tôi');
    await element('personalization-form').emit('submit');
    const nameCall = calls.find(call => call.url.endsWith('personalization/update'));
    assert.deepEqual(nameCall.body, { app_name: 'Mạng riêng của tôi' });
    assert.equal(element('app-name').textContent, 'Mạng riêng của tôi');
    assert.equal(document.title, 'Mạng riêng của tôi · Staff');
    personalizationFailure = true; nameInput.value = 'Invalid'; await element('personalization-form').emit('submit');
    assert.equal(element('app-name').textContent, 'Mạng riêng của tôi'); assert.equal(element('message').className, 'error');
    await element('nav-customers').emit('click'); assert.equal(element('personalization').hidden, true);
    await element('new-customer').emit('click');
    const form = element('customer-form');
    assert.equal(form.elements.password.required, true);
    assert.equal(element('customer-plan').children.length, 3);
    form.elements.staff_plan_id.value = '2'; await element('customer-plan').emit('change');
    assert.equal(form.elements.transfer_enable.value, '200'); assert.equal(form.elements.speed_limit.value, '100');
    form.elements.email.value = 'new@example.com'; form.elements.password.value = 'new-password';
    form.elements.transfer_enable.value = '50.5'; form.elements.speed_limit.value = '100';
    form.elements.expired_at.value = ''; form.elements.remarks.value = 'New note';
    await form.emit('submit');
    const created = calls.find(call => call.url.endsWith('user/create'));
    assert.equal(created.body.transfer_enable, 54223962112); assert.equal(created.body.expired_at, null);
    assert.equal(created.body.u, 0); assert.equal(created.body.d, 0); assert.equal(created.body.speed_limit, 100);
    assert.equal(created.options.headers.Authorization, 'test-token');
    assert.equal(created.body.staff_plan_id, 2);
    for (const forbidden of ['staff_owner_id', 'staff_creator_id', 'is_staff', 'is_admin', 'staff_customer_limit', 'id', 'banned', 'plan_id', 'balance', 'device_limit', 'commission_rate', 'discount']) assert.equal(Object.hasOwn(created.body, forbidden), false);
    assert.equal(element('new-customer').disabled, true);
    assert.equal(element('quota-count').textContent, '2 / 2');
    assert.equal(element('quota-fill').style.width, '100%');
    await element('new-customer').emit('click');
    assert.equal(element('new-customer').disabled, true);
    const edit = element('customer-rows').children[0].children.at(-1).children[0];
    await edit.emit('click');
    assert.equal(element('customer-menu').hidden, false);
    const menuHtml = fs.readFileSync('resources/views/staff.blade.php', 'utf8').split('id="customer-menu"')[1].split('</ul>')[0];
    assert.equal((menuHtml.match(/role="menuitem"/g) || []).length, 7);
    assert.ok(!/Chỉ định đơn hàng|Các [đĐ]ơn [hH]àng|Người mời/.test(menuHtml));
    await element('action-edit').emit('click');
    assert.equal(form.elements.password.required, false);
    assert.equal(form.elements.u.value, String(1073741825 / 1073741824));
    const editorHtml = fs.readFileSync('resources/views/staff.blade.php', 'utf8').split('id="customer-form"')[1].split('</form>')[0];
    for (const forbidden of ['invite_user_email', 'plan_id', 'balance', 'commission_balance', 'device_limit', 'commission_type', 'commission_rate', 'discount', 'is_admin', 'is_staff']) assert.ok(!editorHtml.includes('name="' + forbidden + '"'));
    form.elements.remarks.value = 'Updated'; await form.emit('submit');
    const updated = calls.find(call => call.url.endsWith('user/update'));
    assert.equal(Object.hasOwn(updated.body, 'password'), false);
    assert.equal(updated.body.banned, 0); assert.equal(updated.body.id, 345);
    for (const unchanged of ['u', 'd', 'transfer_enable', 'invite_user_email']) assert.equal(Object.hasOwn(updated.body, unchanged), false);
    assert.equal(customers[0].u, 1073741825); assert.equal(customers[0].staff_plan_id, 1);
    assert.equal(Object.hasOwn(updated.body, 'staff_plan_id'), false);
    await edit.emit('click'); await element('action-edit').emit('click');
    form.elements.u.value = '1.5'; form.elements.d.value = '2.25'; form.elements.speed_limit.value = '';
    await form.emit('submit');
    const changed = calls.filter(call => call.url.endsWith('user/update')).at(-1).body;
    assert.equal(changed.u, 1610612736); assert.equal(changed.d, 2415919104);
    assert.equal(changed.speed_limit, null); assert.equal(Object.hasOwn(changed, 'invite_user_email'), false);
    await edit.emit('click'); await element('action-edit').emit('click');
    form.elements.staff_plan_id.value = '2'; await element('customer-plan').emit('change');
    assert.equal(form.elements.transfer_enable.value, '200');
    assert.equal(form.elements.u.value, '1.5'); assert.equal(form.elements.d.value, '2.25');
    await form.emit('submit');
    const planChange = calls.filter(call => call.url.endsWith('user/update')).at(-1).body;
    assert.equal(planChange.staff_plan_id, 2); assert.equal(planChange.transfer_enable, 200 * 1073741824);
    assert.equal(planChange.speed_limit, 100); assert.equal(Object.hasOwn(planChange, 'u'), false);
    // Real browsers omit selected disabled options from FormData after revocation.
    const revoked = plans.pop();
    await edit.emit('click'); await element('action-edit').emit('click');
    const revokedOption = element('customer-plan').children.at(-1);
    assert.equal(revokedOption.value, '2'); assert.equal(revokedOption.disabled, true);
    form.elements.remarks.value = 'After revocation'; await form.emit('submit');
    const retained = calls.filter(call => call.url.endsWith('user/update')).at(-1).body;
    assert.equal(Object.hasOwn(retained, 'staff_plan_id'), false); assert.equal(customers[0].staff_plan_id, 2);
    plans.push(revoked);
    const beforeInvalid = calls.length; form.elements.u.value = '-1'; await form.emit('submit');
    assert.equal(calls.length, beforeInvalid);
    createFailure = true;
    form.elements.id.value = ''; form.elements.email.value = 'overflow@example.com'; form.elements.password.value = 'password123';
    form.elements.u.value = '0';
    await form.emit('submit');
    assert.equal(element('message').className, 'error'); assert.match(element('message').textContent, /hạn mức/);
    element('customer-dialog').close();
    const openMenu = async () => element('customer-rows').children[0].children.at(-1).children[0].emit('click');
    await openMenu(); await element('action-copy').emit('click');
    assert.deepEqual(copied, ['https://demo.example.com/subscribe?token=demo-345']);
    assert.equal(element('customer-detail-dialog').open, true);
    await element('close-customer-detail').emit('click');
    assert.equal(element('customer-detail-content').children.length, 0);
    await openMenu(); await element('action-qr').emit('click');
    const svg = element('customer-detail-content').children[0].children[0];
    assert.equal(svg.tagName, 'svg'); assert.equal(svg.attributes['aria-label'], 'Mã QR subscription');
    assert.ok(svg.children[1].attributes.d.length > 500);
    await element('close-customer-detail').emit('click');
    confirmation = false;
    await openMenu(); await element('action-reset').emit('click');
    assert.equal(calls.some(call => call.url.endsWith('user/resetSecret')), false);
    confirmation = true;
    await openMenu(); await element('action-reset').emit('click');
    assert.deepEqual(calls.find(call => call.url.endsWith('user/resetSecret')).body, { id: 345, confirm: 1 });
    await openMenu(); await element('action-traffic').emit('click');
    assert.equal(element('detail-previous').disabled, true); assert.equal(element('detail-next').disabled, true);
    await element('close-customer-detail').emit('click');
    confirmation = false;
    await openMenu(); await element('action-delete').emit('click');
    assert.equal(calls.some(call => call.url.endsWith('user/delUser')), false);
    confirmation = true;
    await openMenu(); await element('action-delete').emit('click');
    assert.deepEqual(calls.find(call => call.url.endsWith('user/delUser')).body, { id: 345, confirm: 1 });
    assert.equal(element('customer-rows').children.length, 1);
    assert.equal(element('new-customer').disabled, false);
    assert.equal(element('quota-count').textContent, '1 / 2');
    await element('nav-history').emit('click');
    assert.equal(element('activity-history').hidden, false); assert.equal(element('customers').hidden, true);
    assert.equal(element('activity-previous').disabled, true); assert.equal(element('activity-next').disabled, true);
    const historyTable = element('activity-rows').children[0];
    const historyDetails = historyTable.children[1].children[0].children[3].children[0];
    assert.equal(historyDetails.children[1].children[0].textContent, 'Ghi chú: — → <script>unsafe()</script>');
    assert.equal(historyDetails.children[1].children[1].textContent, 'Tổng (GB): 1.000 → 2.000');
    await element('nav-customers').emit('click');
    await openMenu(); await element('action-history').emit('click');
    assert.ok(calls.at(-1).url.includes('search=346'));
    await element('logout').emit('click');
    assert.equal(storage.has('v2pro_staff_auth'), false); assert.equal(element('workspace').hidden, true);
    assert.equal(element('customer-rows').children.length, 0);
    assert.equal(element('quota-count').textContent, '— / —');
    assert.equal(element('quota-fill').style.width, '0%');
    assert.equal(element('customer-plan').children.length, 1);
    assert.equal(element('customer-plan').children[0].value, '');
    assert.ok(calls.every(call => !/ticket\/|notice\/|plan\/(save|assign|drop)|user\/sendMail|user\/ban|user\/getInvites/.test(call.url)));
    console.log('Staff UI smoke checks passed: customer actions, activity history, QR, copy, confirmations, ownership API wiring, quota, personalization and logout.');
})().catch(error => { console.error(error); process.exitCode = 1; });
