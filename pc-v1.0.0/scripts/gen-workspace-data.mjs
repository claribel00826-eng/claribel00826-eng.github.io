/** 从 data/qa-workspace.json 生成 js/qa-workspace-data.js（离线/ fetch 失败回退） */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'data', 'qa-workspace.json');
const outPath = path.join(root, 'js', 'qa-workspace-data.js');

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const payload = { version: data.version, pairs: data.pairs };
const out =
  '/** 内置种子 · 源：data/qa-workspace.json · 运行 node scripts/gen-workspace-data.mjs 更新 */\n' +
  'window.__QA_WORKSPACE_SEED__ = ' +
  JSON.stringify(payload) +
  ';\n';

fs.writeFileSync(outPath, out, 'utf8');
console.log('✓', outPath, 'pairs=', payload.pairs.length);
