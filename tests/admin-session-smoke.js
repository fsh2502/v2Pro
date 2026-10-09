// Run the actual bundled request module with controlled HTTP responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bundle = fs.readFileSync('public/assets/admin/umi.js', 'utf8');
let cleared = 0, result, calls = [], notices = [];
const context = vm.createContext({ window: { location: { origin: 'https://test.example', pathname: '/admin' } } });
const boot = /o\.push\(\[1, 2, 0\]\),\s+n\(\)/;
assert.match(bundle, boot);
vm.runInContext(bundle.replace(boot, 'window.testRequire = a'), context);
const req = context.window.testRequire;
const asyncToGenerator = fn => function (...args) {
    const iterator = fn.apply(this, args);
    return new Promise((resolve, reject) => {
        function step(method, value) {
            let next;
            try { next = iterator[method](value); } catch (error) { reject(error); return; }
            if (next.done) resolve(next.value);
            else Promise.resolve(next.value).then(value => step('next', value), error => step('throw', error));
        }
        step('next');
    });
};
const dependencies = {
    p0pE: Object.assign, '1l/V': asyncToGenerator, '/xke': {},
    TeRw: { a: { error: notice => notices.push(notice) } },
    Hg0r: { b: async (url, options) => {
        calls.push({ url, options });
        if (result instanceof Error) throw result;
        return result;
    } },
    '20nU': { a: { serviceHost: 'https://test.example/api/v1' } },
    yWgo: { c: () => 'test-token', g: () => { cleared++; } }
};
for (const [id, exports] of Object.entries(dependencies)) req.m[id] = module => { module.exports = exports; };
const get = req('t3Un').a;
const response = (status, body, contentType = 'application/json') => ({
    status, headers: { get: () => contentType }, json: async () => body,
    arrayBuffer: async () => { throw new Error('JSON response was treated as binary'); }
});
(async () => {
    result = response(200, { data: { is_admin: 1 } }, 'application/json; charset=utf-8');
    assert.equal((await get('/user/checkLogin')).data.is_admin, 1);
    result = response(403, { message: 'Monitor unavailable' });
    const monitor = await get('https://test.example/monitor/api/stats', null, { preserveSessionOnForbidden: true });
    assert.equal(monitor.code, 403);
    assert.equal(cleared, 0);
    assert.equal(context.window.location.href, undefined);
    assert.equal(notices.at(-1).description, 'Monitor unavailable');
    assert.equal(calls.at(-1).options.headers.authorization, 'test-token');
    assert.equal('preserveSessionOnForbidden' in calls.at(-1).options, false);
    assert.ok(!calls.at(-1).url.includes('preserveSessionOnForbidden'));
    result = response(500, { message: 'Queue unavailable' });
    assert.equal((await get('https://test.example/monitor/api/stats', null, { preserveSessionOnForbidden: true })).code, 500);
    assert.equal(cleared, 0);
    for (const status of [401, 403, 429, 500, 502, 503]) {
        for (const contentType of ['application/json; charset=utf-8', 'text/html; charset=utf-8', null]) {
            result = response(status, { message: '' }, contentType);
            if (!contentType || contentType.startsWith('text/html')) {
                result.json = async () => { throw new Error('HTML error must not be parsed as JSON'); };
                result.arrayBuffer = async () => new ArrayBuffer(12);
            }
            const monitorError = await get('https://test.example/monitor/api/stats', null, { preserveSessionOnForbidden: true });
            assert.equal(monitorError.code, status);
            assert.equal(cleared, 0, `Monitor ${status} (${contentType}) must not purge the session`);
            assert.equal(context.window.location.href, undefined);
        }
    }
    result = new Error('Network unavailable');
    await assert.rejects(get('https://test.example/monitor/api/stats', null, { preserveSessionOnForbidden: true }), /Network unavailable/);
    result = response(200, {});
    result.json = async () => { throw new SyntaxError('Invalid monitor JSON'); };
    await assert.rejects(get('https://test.example/monitor/api/stats', null, { preserveSessionOnForbidden: true }), /Invalid monitor JSON/);
    assert.equal(cleared, 0);
    assert.equal(context.window.location.href, undefined);
    result = response(200, { data: { is_admin: 1 } });
    assert.equal((await get('/user/info')).data.is_admin, 1, 'The main API must remain usable after monitor errors');
    result = response(403, { message: 'Session expired' });
    assert.equal((await get('/user/info')).code, 403);
    assert.equal(cleared, 1);
    assert.equal(context.window.location.href, 'https://test.example/admin');
    // A proxy-generated HTML 403 from a protected main API still invalidates the session.
    result = response(403, {}, 'text/html');
    result.arrayBuffer = async () => new ArrayBuffer(12);
    assert.equal((await get('/user/info')).code, 403);
    assert.equal(cleared, 2);
    assert.match(bundle, /"\/monitor\/api\/stats", null, \{\s+preserveSessionOnForbidden: !0/);
    console.log('Admin session checks passed: JWT header, monitor JSON/HTML/missing type errors (401/403/429/500/502/503), network/parse errors, recovery, and protected API 403 redirect.');
})().catch(error => { console.error(error); process.exitCode = 1; });
