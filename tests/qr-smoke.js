const fs = require('fs');
const vm = require('vm');

const context = { window: { webpackJsonp: [] } };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync('public/assets/admin/qrcode.async.js', 'utf8'),
  context
);

const modules = context.window.webpackJsonp[0][1];
const cache = {};
const requireModule = (id) => {
  if (cache[id]) return cache[id].exports;

  const module = (cache[id] = { exports: {} });
  modules[id](module, module.exports, requireModule);
  return module.exports;
};

const QRCode = requireModule('H38U');
const levels = requireModule('aRTE');
const subscriptionUrl = 'https://example.com/subscription/demo';
const qr = new QRCode(-1, levels.M);

qr.addData(subscriptionUrl);
qr.make();

if (
  qr.moduleCount < 21 ||
  qr.modules.length !== qr.moduleCount ||
  !qr.modules[0][0] ||
  !qr.modules[6][6]
) {
  throw new Error('QR generator returned an invalid matrix');
}

console.log(`QR matrix OK: ${qr.moduleCount}x${qr.moduleCount}`);

if (process.argv[2]) {
  const quietZone = 4;
  const viewBoxSize = qr.moduleCount + quietZone * 2;
  const paths = [];

  qr.modules.forEach((row, y) => {
    let start = null;
    row.forEach((dark, x) => {
      if (dark && start === null) start = x;
      if ((!dark || x === row.length - 1) && start !== null) {
        const end = dark && x === row.length - 1 ? x + 1 : x;
        paths.push(`M${start + quietZone} ${y + quietZone}h${end - start}v1H${start + quietZone}z`);
        start = null;
      }
    });
  });

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"',
    ` viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" shape-rendering="crispEdges">`,
    `<path fill="#fff" d="M0 0h${viewBoxSize}v${viewBoxSize}H0z"/>`,
    `<path fill="#111827" d="${paths.join('')}"/>`,
    '</svg>',
  ].join('');

  if (process.argv[2].toLowerCase().endsWith('.png')) {
    const zlib = require('zlib');
    const scale = 8;
    const imageSize = viewBoxSize * scale;
    const raw = Buffer.alloc((imageSize * 3 + 1) * imageSize);

    for (let y = 0; y < imageSize; y += 1) {
      const rowOffset = y * (imageSize * 3 + 1);
      raw[rowOffset] = 0;
      for (let x = 0; x < imageSize; x += 1) {
        const moduleX = Math.floor(x / scale) - quietZone;
        const moduleY = Math.floor(y / scale) - quietZone;
        const dark =
          moduleX >= 0 &&
          moduleY >= 0 &&
          moduleX < qr.moduleCount &&
          moduleY < qr.moduleCount &&
          qr.modules[moduleY][moduleX];
        const color = dark ? 17 : 255;
        const pixelOffset = rowOffset + 1 + x * 3;
        raw[pixelOffset] = color;
        raw[pixelOffset + 1] = dark ? 24 : 255;
        raw[pixelOffset + 2] = dark ? 39 : 255;
      }
    }

    const crc32 = (buffer) => {
      let crc = 0xffffffff;
      for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
          crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    const chunk = (type, data) => {
      const typeBuffer = Buffer.from(type);
      const result = Buffer.alloc(data.length + 12);
      result.writeUInt32BE(data.length, 0);
      typeBuffer.copy(result, 4);
      data.copy(result, 8);
      result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
      return result;
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(imageSize, 0);
    header.writeUInt32BE(imageSize, 4);
    header.set([8, 2, 0, 0, 0], 8);
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    fs.writeFileSync(process.argv[2], png);
  } else {
    fs.writeFileSync(process.argv[2], svg);
  }
  console.log(`QR demo written to ${process.argv[2]}`);
}
