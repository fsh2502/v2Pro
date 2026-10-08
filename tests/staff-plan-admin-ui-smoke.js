// Isolated checks for the Admin component; no live account or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [], gb = 1073741824;
let fail = false;
const plans = [{ id: 101, name: 'Staff 100 GB', group_id: 1, transfer_enable: 100 * gb, speed_limit: 50, device_limit: 2, enabled: true }];
const context = vm.createContext({ window: { settings: { secure_path: 'demo-admin' }, localStorage: { getItem: key => key === 'authorization' ? 'admin-token' : null } },
    fetch: async (url, options) => {
        const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, options, body });
        if (fail) return { ok: false, json: async () => ({ errors: { name: ['Invalid name'] } }) };
        if (url.endsWith('/save')) plans.push({ ...body, id: 102 });
        return { ok: true, json: async () => ({ data: /\/fetch(?:\?|$)/.test(url) ? { plans, groups: [{ id: 1, name: 'Staff servers' }], allowed_plan_ids: [101] } : true }) };
    } });
vm.runInContext(fs.readFileSync('public/assets/admin/staff-plans.js', 'utf8'), context);
class Component { constructor(props) { this.props = props; } setState(values) { this.state = { ...this.state, ...values }; } }
const React = { Component, Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
const flatten = node => !node || typeof node !== 'object' ? [] : [node, ...node.children.flatMap(flatten)];
const textOf = node => !node || typeof node !== 'object' ? String(node || '') : node.children.map(textOf).join('');
const clickEvent = { preventDefault() {}, stopPropagation() {} };
(async () => {
    const StaffPlans = context.window.createStaffPlansComponent(React);
    assert.equal(context.window.createStaffPlansComponent(React), StaffPlans);
    const component = new StaffPlans({ staffId: 12, staffCode: 'STF-000012' });
    component.dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
    await component.run(() => component.load());
    assert.equal(component.state.selected[0], 101);
    component.edit(plans[0]); assert.equal(component.state.form.transfer_enable, '100');
    component.change('name', 'Staff 200 GB'); component.change('transfer_enable', '200');
    delete component.state.form.id;
    // Await the same operation invoked by the actual Save button.
    const originalRun = component.run.bind(component); let pending;
    component.run = callback => pending = originalRun(callback);
    component.save(clickEvent); await pending;
    const saved = calls.find(call => call.url.endsWith('/save'));
    assert.equal(saved.body.transfer_enable, 200 * gb); assert.equal(saved.body.group_id, 1);
    assert.equal(saved.body.name, 'Staff 200 GB'); assert.equal(Object.hasOwn(saved.body, 'plan_id'), false);
    assert.equal(component.state.plans.length, 2);
    let nodes = flatten(component.render());
    assert.equal(nodes.some(node => node.type === 'form'), false); // Fits inside the existing Admin form.
    const checkbox = nodes.find(node => node.type === 'input' && node.props['aria-label'] === 'Cho phép Staff 200 GB');
    checkbox.props.onChange({ target: { checked: true } });
    nodes = flatten(component.render());
    const grant = nodes.find(node => node.type === 'button' && textOf(node) === 'Lưu quyền sử dụng');
    await grant.props.onClick();
    const assignment = calls.find(call => call.url.endsWith('/assign'));
    assert.deepEqual(assignment.body, { staff_id: 12, plan_ids: [101, 102] });
    const catalog = new StaffPlans({ catalogOnly: true });
    await catalog.load();
    assert.equal(calls.at(-1).url, '/api/v1/demo-admin/staff-plan/fetch');
    const catalogNodes = flatten(catalog.render());
    assert.equal(catalogNodes.some(node => node.type === 'input' && node.props.type === 'checkbox'), false);
    assert.equal(catalogNodes.some(node => node.type === 'button' && textOf(node) === 'Lưu quyền sử dụng'), false);
    const dialog = nodes.find(node => node.type === 'dialog');
    let prevented = false;
    dialog.props.onKeyDown({ key: 'Enter', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; }, stopPropagation() {} });
    assert.equal(prevented, false);
    fail = true; await component.run(() => component.load());
    assert.equal(component.state.error, true); assert.equal(component.state.message, 'Invalid name');
    assert.equal(component.state.busy, false);
    assert.ok(calls.every(call => call.url.startsWith('/api/v1/demo-admin/staff-plan/')));
    assert.ok(calls.every(call => call.options.headers.Authorization === 'admin-token' && call.options.cache === 'no-store'));
    component.dialog.open = true; component.componentWillUnmount(); assert.equal(component.dialog.open, false);
    const bundle = fs.readFileSync('public/assets/admin/umi.js', 'utf8');
    assert.ok(!bundle.includes('t.is_staff && window.createStaffPlansComponent'));
    assert.ok(bundle.includes('component: window.createCtvComponent'));
    console.log('Admin Staff plan checks passed: private catalog, byte conversion, scoped grants, authentication, errors and CTV integration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
