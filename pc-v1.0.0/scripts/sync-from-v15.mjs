#!/usr/bin/env node
/** 从 v1.5.0 Excel 或 intent-qa.generated.js 同步到 pc-v1.0.0/data/qa-workspace.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const out = path.join(__dirname, '../data/qa-workspace.json');

const jsPath = path.join(root, 'v1.5.0/js/intent-qa.generated.js');
const text = fs.readFileSync(jsPath, 'utf8');
const m = text.match(/window\.IntentQa = (\{[\s\S]*\})\s*;\s*\}\)/);
if (!m) {
  console.error('无法解析 intent-qa.generated.js');
  process.exit(1);
}
const data = JSON.parse(m[1]);
const pairs = data.pairs.map((p, i) => ({
  id: i + 1,
  q: p.q,
  a: p.a,
  aId: p.aId || '',
  note: p.note || '',
  status: 'published'
}));

const workspace = {
  version: data.version || 'v1.5.0',
  algorithm: data.algorithm || 'C',
  updatedAt: new Date().toISOString(),
  pairs
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(workspace, null, 2), 'utf8');
console.log('✓ 写入', path.relative(root, out), 'pairs=', pairs.length);
