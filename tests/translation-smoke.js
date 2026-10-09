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
assert.equal(admin['选择年代'], 'Chọn thập kỷ');
assert.equal(admin['下一世纪'], 'Thế kỷ sau');
assert.match(user['快速将节点导入对应客户端进行使用'], /Nhập nhanh/);
assert.match(user['不会使用，查看使用教程'], /Xem hướng dẫn/);

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
// Exercise the shipped user's shared locale module and recharge expression,
// including a changed currency and the fallback for another UI language.
const userBundle = fs.readFileSync('public/theme/default/assets/umi.js', 'utf8').replace(/\r\n/g, '\n');
let activeDictionary = user;
const formatMessage = ({ id, defaultMessage }, args = {}) =>
    (activeDictionary[id] ?? defaultMessage ?? id).replace(/\{(\w+)\}/g, (_, key) => args[key]);
const localeStart = userBundle.indexOf('tI4l: function(e, t, n) {') + 'tI4l: '.length;
const localeEnd = userBundle.indexOf(',\n    tRgb:', localeStart);
assert.ok(localeStart > 6 && localeEnd > localeStart);
const localeFactory = vm.runInNewContext('(' + userBundle.slice(localeStart, localeEnd) + ')');
const localeExports = {};
localeFactory({}, localeExports, id => {
    assert.equal(id, 'Y2fQ');
    return { formatMessage };
});
assert.equal(localeExports.a.i18nText['zh-CN'], 'Tiếng Trung giản thể');
assert.equal(localeExports.a.i18nText['ja-JP'], 'Tiếng Nhật');
assert.equal(localeExports.a.i18nText['en-US'], 'Tiếng Anh');
activeDictionary = {};
assert.equal(localeExports.a.i18nText['zh-CN'], '简体中文');
assert.equal(localeExports.a.i18nText['en-US'], 'English');
activeDictionary = user;
const rechargeId = userBundle.indexOf('id: "\\u8bf7\\u8f93\\u5165\\u5145\\u503c\\u91d1\\u989d{currency}"');
assert.ok(rechargeId > 0);
const rechargeStart = userBundle.lastIndexOf('placeholder: ', rechargeId) + 'placeholder: '.length;
const rechargeEnd = userBundle.indexOf(',\n                        onChange:', rechargeId);
assert.ok(rechargeEnd > rechargeStart);
for (const currency of ['CNY', 'VND', 'USD']) {
    const rendered = vm.runInNewContext(userBundle.slice(rechargeStart, rechargeEnd), {
        m: { formatMessage }, e: { props: { comm: { config: { currency } } } }
    });
    assert.equal(rendered, `Nhập số tiền nạp (${currency})`);
}
// Exercise every real gift-card success branch without redeeming a live card.
const giftStart = userBundle.indexOf('r["a"].success(giftI18n.formatMessage');
const giftEnd = userBundle.indexOf('})());', giftStart) + '})());'.length;
assert.ok(giftStart > 0 && giftEnd > giftStart);
assert.match(userBundle.slice(userBundle.indexOf('hlQx: function'), giftStart), /var giftI18n = n\("Y2fQ"\)/);
for (const [type, value, expected] of [
    [1, 12345, 'Số dư tài khoản: 123.45'],
    [2, 3, 'Thời hạn gói: 3 ngày'],
    [3, 100, 'Dung lượng gói: 100 GB'],
    [4, 0, 'Đã đặt lại dung lượng'],
    [5, 30, 'Gói dịch vụ: 30 ngày'],
    [99, 0, 'Loại thẻ không xác định']
]) {
    let notice;
    vm.runInNewContext(userBundle.slice(giftStart, giftEnd), {
        giftI18n: { formatMessage }, u: { type, value }, r: { a: { success: value => { notice = value; } } }
    });
    assert.equal(notice, `Đổi quà thành công: ${expected}`);
}
console.log(`Vietnamese translation checks passed: ${Object.keys(admin).length} Admin / ${Object.keys(user).length} user entries; parameters, dynamic labels/placeholders, gift notices and editable data preserved.`);
