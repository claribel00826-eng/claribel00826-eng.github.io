#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const transcriptPath =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'd-vibecoding-claribel00826-eng-github-io',
    'agent-transcripts',
    '3475ae58-cf22-4281-a818-a344ec2def28',
    '3475ae58-cf22-4281-a818-a344ec2def28.jsonl'
  );

function relPath(p) {
  let s = String(p).replace(/\\/g, '/');
  const marker = 'claribel00826-eng.github.io/';
  const idx = s.indexOf(marker);
  if (idx >= 0) s = s.slice(idx + marker.length);
  return s;
}

const sourceFiles = {
  'v1.3.0/js/skills.js': path.join(ROOT, 'v1.3.0/js/skills.js.gitbase'),
  'v1.3.0/js/app.js': path.join(ROOT, 'v1.3.0/js/app.js'),
  'v1.3.0/js/demo-data.js': path.join(ROOT, 'v1.3.0/js/demo-data.js'),
  'v1.3.0/css/main.css': path.join(ROOT, 'v1.3.0/css/main.css'),
  'v1.3.0/index.html': path.join(ROOT, 'v1.3.0/index.html')
};

const outFiles = {
  'v1.3.0/js/skills.js': path.join(ROOT, 'v1.3.0/js/skills.js'),
  'v1.3.0/js/app.js': path.join(ROOT, 'v1.3.0/js/app.js'),
  'v1.3.0/js/demo-data.js': path.join(ROOT, 'v1.3.0/js/demo-data.js'),
  'v1.3.0/css/main.css': path.join(ROOT, 'v1.3.0/css/main.css'),
  'v1.3.0/index.html': path.join(ROOT, 'v1.3.0/index.html')
};

const texts = {};
for (const [rel, src] of Object.entries(sourceFiles)) {
  texts[rel] = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : '';
}

const lines = fs.readFileSync(transcriptPath, 'utf8').split(/\n/).filter(Boolean);
const stats = {};

for (const line of lines) {
  try {
    const row = JSON.parse(line);
    const content = row.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type !== 'tool_use') continue;
      const name = block.name;
      const input = block.input || {};
      if (!input.path) continue;
      const rel = relPath(input.path);
      if (!texts[rel]) continue;
      if (!stats[rel]) stats[rel] = { ok: 0, skip: 0 };

      if (name === 'Write' && input.contents) {
        texts[rel] = input.contents;
        stats[rel].ok++;
        continue;
      }
      if (name !== 'StrReplace' || !input.old_string || !input.new_string) continue;

      if (input.replace_all) {
        if (!texts[rel].includes(input.old_string)) {
          stats[rel].skip++;
          continue;
        }
        texts[rel] = texts[rel].split(input.old_string).join(input.new_string);
        stats[rel].ok++;
      } else {
        if (!texts[rel].includes(input.old_string)) {
          stats[rel].skip++;
          continue;
        }
        texts[rel] = texts[rel].replace(input.old_string, input.new_string);
        stats[rel].ok++;
      }
    }
  } catch {
    /* skip */
  }
}

for (const [rel, text] of Object.entries(texts)) {
  if (outFiles[rel]) fs.writeFileSync(outFiles[rel], text, 'utf8');
}

console.log(JSON.stringify(stats, null, 2));
