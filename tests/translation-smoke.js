const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: { settings: { i18n: {} } } };
vm.runInNewContext(fs.readFileSync('public/assets/admin/vi-VN.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('public/theme/default/assets/i18n/vi-VN.js', 'utf8'), context);
const admin = context.window.zhViDictionary;
const user = context.window.settings.i18n['vi-VN'];
const parameters = value => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
for (const dictionary of [admin, user]) {
    for (const [key, value] of Object.entries(dictionary)) {
        assert.ok(!/[\u3400-\u9fff]/.test(value), `Untranslated value: ${key}`);
        assert.deepEqual(parameters(value), parameters(key), `Interpolation changed: ${key}`);
    }
}
assert.equal(admin['比例'], 'Tỷ lệ');
assert.equal(admin['显示'], 'Hiển thị');
assert.equal(admin['显隐'], 'Hiển thị');
assert.equal(user['工单历史'], 'Lịch sử hỗ trợ');
assert.match(user['快速将节点导入对应客户端进行使用'], /Nhập nhanh/);
assert.match(user['不会使用，查看使用教程'], /Xem hướng dẫn/);

// Run the real DOM translator against updates to existing labels/attributes.
const element = (tag, attributes = {}, children = [], skip = false) => {
    const node = { nodeType: 1, attributes, childNodes: children,
        hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
        getAttribute(name) { return this.attributes[name]; },
        setAttribute(name, value) { this.attributes[name] = value; },
        matches() { return skip; }, closest() { return skip ? this : null; }
    };
    children.forEach(child => child.parentElement = node);
    return node;
};
const label = { nodeType: 3, nodeValue: '  编辑知识  ' };
const editable = { nodeType: 3, nodeValue: '天' };
const input = element('input', { placeholder: '请输入知识标题', value: '天' });
const code = { nodeType: 3, nodeValue: '比例' };
const body = element('body', {}, [element('label', {}, [label]), input,
    element('textarea', {}, [editable], true), element('code', {}, [code], true)]);
let observer, loaded;
Object.assign(context, {
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }, document: { body },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} }
});
context.window.addEventListener = (name, callback) => { loaded = callback; };
vm.runInNewContext(fs.readFileSync('public/assets/admin/v2b-mod.js', 'utf8'), context);
loaded();
assert.equal(label.nodeValue, '  Chỉnh sửa bài hướng dẫn  ');
assert.equal(input.attributes.placeholder, 'Nhập tiêu đề bài hướng dẫn');
assert.equal(input.attributes.value, '天');
assert.equal(editable.nodeValue, '天');
assert.equal(code.nodeValue, '比例');
label.nodeValue = '比例';
input.attributes.placeholder = '请输入邮箱';
observer([{ type: 'characterData', target: label }, { type: 'attributes', target: input }]);
assert.equal(label.nodeValue, 'Tỷ lệ');
assert.equal(input.attributes.placeholder, 'Nhập email');
console.log(`Vietnamese translation checks passed: ${Object.keys(admin).length} Admin / ${Object.keys(user).length} user entries; parameters, dynamic labels/placeholders and editable data preserved.`);
