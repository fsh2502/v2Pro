// Exercise the actual default-theme import menu with DOM/platform stubs.
// Does not open applications, make HTTP requests or load a real account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bundle = fs.readFileSync('public/theme/default/assets/umi.js', 'utf8');
const start = bundle.indexOf('            renderSubscribeBox() {');
const end = bundle.indexOf('            render() {', start);
assert.ok(start !== -1 && end > start, 'Default subscription menu must exist');
const method = bundle.slice(start, end);
const source = 'https://example.test/sub?token=a%2Bb&flag=old#stale';

for (const name of ['🇯🇵SHOPTUANTRUONG🇻🇳', '👩🏽‍💻 Mạng Việt ❤️', 'Tên & # + % ? = "B"']) {
    const actions = [];
    const window = { settings: { title: name }, location: {}, btoa: value => Buffer.from(value, 'binary').toString('base64') };
    const context = {
        window, URL,
        u: Object.fromEntries(['i', 'j', 'k', 'n', 'g'].map(key => [key, () => true])),
        c: { a: { createElement: (tag, props, ...children) => {
            if (props?.className?.startsWith('item ') && props.onClick) actions.push(props);
            return { tag, props, children };
        } } },
        v: { a: { item: 'item', oneClickSubscribe: 'menu' } },
        p: { formatMessage: () => '' }, i: { a: 'button' },
    };
    vm.runInNewContext(`({${method}}).renderSubscribeBox.call({props: {subscribeUrl: ${JSON.stringify(source)}}})`, context);
    for (const action of actions) {
        if (action.className.includes('subsrcibe-for-link') || action.className.includes('subscribe-for-qrcode')) continue;
        action.onClick();
        const link = new URL(window.location.href);
        if (link.protocol === 'hiddify:') {
            assert.equal(link.searchParams.get('name'), name);
            const subscription = new URL(link.searchParams.get('url'));
            assert.equal(subscription.searchParams.get('token'), 'a+b');
            assert.deepEqual(subscription.searchParams.getAll('flag'), ['hiddify']);
            assert.equal(subscription.hash, '');
            assert.equal(link.hash, '');
        } else if (link.protocol === 'sing-box:') {
            assert.equal(decodeURIComponent(link.hash.slice(1)), name);
        } else if (link.protocol === 'quantumult-x:') {
            assert.equal(JSON.parse(link.searchParams.get('remote-resource')).server_remote[0], `${source}, tag=${name}`);
        } else {
            assert.equal(link.searchParams.get(link.protocol === 'shadowrocket:' ? 'remark' : 'name'), name);
        }
    }
    assert.equal(actions.filter(action => action.className === 'item hiddify').length, 1);
}
console.log('PASS: default theme subscription import names preserve flags, emoji and special characters');
