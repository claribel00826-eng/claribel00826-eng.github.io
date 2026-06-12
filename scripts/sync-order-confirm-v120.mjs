import fs from 'fs';
import path from 'path';

const root = path.resolve('D:/工作文件/vibecoding/claribel00826-eng.github.io');

function extract(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error('markers not found: ' + startMarker);
  return src.slice(start, end);
}

const v14 = fs.readFileSync(path.join(root, 'v1.4.0/js/skills.js'), 'utf8');
const v12Path = path.join(root, 'v1.2.0/js/skills.js');
let v12 = fs.readFileSync(v12Path, 'utf8');

let newBlock = [
  extract(v14, 'function enrichOrderLineStock(line)', 'function syncOrderCopyLinesFromDom()'),
  extract(v14, 'function renderOrderConfirmLineProcessField(', 'function renderOrderSuccessCard('),
  extract(v14, 'function refreshLastOrderPickCard()', '/** 新建下单：无报价单则直进选品报价卡'),
].join('\n');

newBlock = newBlock.replace(
  /subMeta\.textContent =[\s\S]*?;\s*\n\s*\}/,
  `subMeta.textContent =
            (line.inventoryCode || '—') +
            ' · ' +
            (line.qty || 0) +
            ' ' +
            (line.salesUnit || '件');
        }`
);

const oldStart = v12.indexOf('function setOrderPending(lines, meta)');
const oldEnd = v12.indexOf('/** 新建下单：无报价单则直进选品报价卡');
if (oldStart === -1 || oldEnd === -1) throw new Error('v1.2 markers not found');

v12 = v12.slice(0, oldStart) + newBlock + v12.slice(oldEnd);
fs.writeFileSync(v12Path, v12);
console.log('patched', v12Path);
