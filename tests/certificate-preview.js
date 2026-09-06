// Local, synthetic UI fixture. Run: node tests/certificate-preview.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = `<!doctype html><html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kiểm thử vân tay chứng chỉ</title>
<link rel="stylesheet" href="/assets/admin/umi.css">
<style>body{padding:24px;background:#f5f6fa}main{max-width:480px;padding:24px;background:white;margin:auto}p{margin-top:12px}.form-group label{font-weight:600}code{font-size:12px}small{display:block;margin-top:8px}</style>
<main><h2>TLS · dữ liệu kiểm thử</h2><div id="root"></div></main>
<script>window.webpackJsonp=[];window.settings={secure_path:'test'};</script>
<script src="/assets/admin/vendors.async.js"></script>
<script src="/fixture-modules.js"></script>
<script src="/assets/admin/certificate.js"></script>
<script>
const modules=Object.assign({},window.fixtureModules,...window.webpackJsonp.map(chunk=>chunk[1])), cache={};
function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,req);return m.exports;}
req.o=(o,p)=>Object.prototype.hasOwnProperty.call(o,p);
req.d=(o,k,get)=>Object.defineProperty(o,k,{enumerable:true,get});
req.n=m=>{const get=m&&m.__esModule?()=>m.default:()=>m;req.d(get,'a',get);return get;};
req.r=o=>Object.defineProperty(o,'__esModule',{value:true});
const React=req('q1tI'), ReactDOM=req('i8i4'), Certificate=window.createNodeCertificateComponent(React);
class Preview extends React.Component {constructor(p){super(p);this.state={enabled:true,proxyTermination:false};}render(){return React.createElement(Certificate,{nodeId:7,enabled:this.state.enabled,onChange:value=>this.setState({enabled:value==='1'}),proxyTermination:this.state.proxyTermination,onProxyTerminationChange:value=>this.setState({proxyTermination:value==='1'})});}}
ReactDOM.render(React.createElement(Preview),document.getElementById('root'));
</script></html>`;
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    if (url.pathname === '/fixture-modules.js') {
        res.setHeader('Content-Type', 'application/javascript');
        // Capture bundled modules without booting the authenticated admin app.
        res.end(fs.readFileSync(path.join(root, 'public/assets/admin/umi.js'), 'utf8')
            .replace('(function(e) {', '(function(e) { window.fixtureModules = e; return;'));
        return;
    }
    if (url.pathname === '/api/v1/test/server/v2node/certificate') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({data:{status:'ok',sha256:'ab'.repeat(32),public_key_sha256:Buffer.alloc(32,255).toString('base64'),updated_at:Math.floor(Date.now()/1000),not_after:Math.floor(Date.now()/1000)+86400*90}}));
        return;
    }
    const assets = ['/assets/admin/umi.css', '/assets/admin/vendors.async.js', '/assets/admin/certificate.js'];
    if (assets.includes(url.pathname)) {
        res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript');
        res.end(fs.readFileSync(path.join(root, 'public', url.pathname)));
        return;
    }
    res.writeHead(404); res.end();
}).listen(8765, '127.0.0.1', () => console.log('Certificate UI fixture: http://127.0.0.1:8765'));
