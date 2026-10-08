// Reuse the pure QR encoder already bundled with the Admin panel.
(() => {
    'use strict';
    const modules = Object.assign({}, ...(window.webpackJsonp || []).map(chunk => chunk[1]));
    const cache = {};
    function load(id) {
        if (cache[id]) return cache[id].exports;
        if (!modules[id]) throw new Error('Không tải được bộ tạo mã QR.');
        const module = cache[id] = { exports: {} };
        modules[id](module, module.exports, load);
        return module.exports;
    }
    window.staffRenderQr = (container, url) => {
        const QRCode = load('H38U'), levels = load('aRTE');
        const qr = new QRCode(-1, levels.M);
        const bytes = new TextEncoder().encode(url);
        qr.addData(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
        qr.make();
        const size = qr.moduleCount + 8, paths = [];
        qr.modules.forEach((row, y) => row.forEach((dark, x) => {
            if (dark) paths.push(`M${x + 4} ${y + 4}h1v1h-1z`);
        }));
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', '280'); svg.setAttribute('height', '280');
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Mã QR subscription');
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        background.setAttribute('fill', '#fff'); background.setAttribute('d', `M0 0h${size}v${size}H0z`);
        const foreground = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        foreground.setAttribute('fill', '#111'); foreground.setAttribute('d', paths.join(''));
        svg.append(background, foreground); container.replaceChildren(svg);
    };
})();
