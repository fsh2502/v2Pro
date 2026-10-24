const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: { settings: { i18n: {} } } };
vm.runInNewContext(fs.readFileSync('public/assets/admin/vi-VN.js', 'utf8'), context);
const admin = context.window.zhViDictionary;
const parameters = value => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
for (const dictionary of [admin]) {
    for (const [key, value] of Object.entries(dictionary)) {
        assert.ok(!/[\u3400-\u9fff]/.test(value), `Untranslated value: ${key}`);
        assert.deepEqual(parameters(value), parameters(key), `Interpolation changed: ${key}`);
    }
}
assert.equal(admin['比例'], 'Tỷ lệ');
assert.equal(admin['显示'], 'Hiển thị');
assert.equal(admin['显隐'], 'Hiển thị');
assert.equal(admin['选择年代'], 'Chọn thập kỷ');
assert.equal(admin['下一世纪'], 'Thế kỷ sau');

// Run the real DOM translator against updates to existing labels/attributes.
const element = (tag, attributes = {}, children = [], skip = false, scope = '') => {
    const node = { nodeType: 1, attributes, childNodes: children,
        hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
        getAttribute(name) { return this.attributes[name]; },
        setAttribute(name, value) { this.attributes[name] = value; },
        matches(selector) {
            if (selector === 'script, style') return ['script', 'style'].includes(tag);
            return skip;
        },
        closest(selector) {
            if (selector.includes('[contenteditable')) return skip ? this : this.parentElement?.closest(selector) || null;
            if (scope === selector) return this;
            return this.parentElement?.closest(selector) || null;
        }
    };
    children.forEach(child => child.parentElement = node);
    return node;
};
const label = { nodeType: 3, nodeValue: '  编辑知识  ' };
const editable = { nodeType: 3, nodeValue: '天' };
const input = element('input', { placeholder: '请输入知识标题', value: '天' });
const code = { nodeType: 3, nodeValue: '比例' };
const textarea = element('textarea', { placeholder: '请在这里记录..', value: '天' }, [editable], true);
const body = element('body', {}, [element('label', {}, [label]), input,
    textarea, element('code', {}, [code], true)]);
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
assert.equal(textarea.attributes.placeholder, admin['请在这里记录..']);
assert.equal(textarea.attributes.value, '天');
assert.equal(admin['Private Key'], 'Khóa riêng tư');
assert.equal(admin['Server Name(SNI)'], 'Tên máy chủ (SNI)');
assert.equal(admin['流量重置包'], 'Gói đặt lại lưu lượng');
// Ace and Markdown preview data must remain untouched, even for dictionary keys.
for (const tag of ['.ace_text-layer', '.rc-md-editor .html-wrap', '[data-no-translate]']) {
    const text = { nodeType: 3, nodeValue: 'Password' };
    const editor = element(tag, {}, [text], true);
    observer([{ type: 'childList', addedNodes: [editor] }]);
    assert.equal(text.nodeValue, 'Password');
}
const accessible = element('button', { 'aria-label': '选择日期', title: '文件上传中' });
observer([{ type: 'childList', addedNodes: [accessible] }]);
assert.equal(accessible.attributes['aria-label'], 'Chọn ngày');
assert.equal(accessible.attributes.title, 'Đang tải tệp lên');
// Replacing an optional dictionary rebuilds the lookup without a stale cache.
context.window.zhViDictionary = { '名称不能为空': 'Vui lòng nhập tên' };
label.nodeValue = '名称不能为空';
observer([{ type: 'characterData', target: label }]);
assert.equal(label.nodeValue, 'Vui lòng nhập tên');
context.window.zhViDictionary = admin;
// The date input and native editor confirmation are localized in the bundles,
// rather than rewriting values or browser dialogs from the DOM translator.
const bundle = fs.readFileSync('public/assets/admin/umi.js', 'utf8');
assert.match(bundle, /dateFormat: "DD\/MM\/YYYY"/);
assert.match(bundle, /dateTimeFormat: "DD\/MM\/YYYY HH:mm:ss"/);
assert.ok(bundle.includes('php artisan reset:password email_quan_tri'));
const components = fs.readFileSync('public/assets/admin/components.async.js', 'utf8');
assert.ok(!components.includes('clearTip:"Are you sure you want to clear all contents?"'));
assert.ok(components.includes('clearTip:"Bạn có chắc muốn xóa toàn bộ nội dung?"'));
console.log('Admin translation checks passed: ' + Object.keys(admin).length + ' entries, dynamic labels, React updates, editable content and bundle locales.');
assert.equal(code.nodeValue, '比例');
label.nodeValue = '比例';
input.attributes.placeholder = '请输入邮箱';
observer([{ type: 'characterData', target: label }, { type: 'attributes', target: input }]);
assert.equal(label.nodeValue, 'Tỷ lệ');
assert.equal(input.attributes.placeholder, 'Nhập email');
for (const [scope, original, expected] of [
    ['[class*="ant-calendar"]', '2032年', 'Năm 2032'],
    ['[class*="ant-calendar"]', '2032年2月29日', '29/2/2032'],
    ['.ant-pagination, .ant-select-dropdown', '50 条/页', '50 / trang'],
    ['.ant-table-tbody', '匹配 17 条规则', 'Khớp 17 quy tắc'],
    ['.ant-table-tbody', '3 天', '3 ngày'],
    ['.ant-modal-title', '配置custom主题', 'Cài đặt giao diện custom'],
    ['', '2032年', '2032年'],
    ['', 'There are too many password errors, please try again after 10 minutes.', 'Bạn nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 10 phút'],
    ['', '匹配 17 条规则', '匹配 17 条规则']
]) {
    const text = { nodeType: 3, nodeValue: original };
    const widget = element('div', { title: original }, [text], false, scope);
    observer([{ type: 'childList', addedNodes: [widget] }]);
    assert.equal(text.nodeValue, expected);
    assert.equal(widget.attributes.title, expected);
}
textarea.attributes.placeholder = '请输入公告内容';
observer([{ type: 'attributes', target: textarea }]);
assert.equal(textarea.attributes.placeholder, admin['请输入公告内容']);
assert.equal(textarea.attributes.value, '天');
