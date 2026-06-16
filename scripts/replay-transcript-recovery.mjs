#!/usr/bin/env node
/**
 * Replay Write/StrReplace from agent transcript JSONL onto workspace.
 * Usage: node scripts/replay-transcript-recovery.mjs [path-to.jsonl]
 */
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

function normalizePath(p) {
  if (!p) return null;
  let s = p.replace(/\\/g, '/');
  const marker = 'claribel00826-eng.github.io/';
  const idx = s.indexOf(marker);
  if (idx >= 0) s = s.slice(idx + marker.length);
  if (s.startsWith('D:/') || s.startsWith('d:/')) {
    const parts = s.split('/');
    const repoIdx = parts.findIndex((x) => x === 'claribel00826-eng.github.io');
    if (repoIdx >= 0) s = parts.slice(repoIdx + 1).join('/');
  }
  return path.join(ROOT, s.replace(/\//g, path.sep));
}

function collectOps(lines) {
  const ops = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const content = row.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const name = block.name;
        const input = block.input || {};
        if (name === 'Write' && input.path && input.contents) {
          ops.push({ type: 'write', path: normalizePath(input.path), contents: input.contents });
        } else if (name === 'StrReplace' && input.path && input.old_string && input.new_string) {
          ops.push({
            type: 'replace',
            path: normalizePath(input.path),
            old_string: input.old_string,
            new_string: input.new_string,
            replace_all: input.replace_all || false
          });
        }
      }
    } catch {
      /* skip bad lines */
    }
  }
  return ops;
}

function applyOp(op, stats) {
  const rel = path.relative(ROOT, op.path);
  if (rel.startsWith('scripts' + path.sep) && op.path.includes('replay-transcript')) return;
  if (!op.path.startsWith(ROOT)) {
    stats.skipOutside++;
    return;
  }

  if (op.type === 'write') {
    fs.mkdirSync(path.dirname(op.path), { recursive: true });
    fs.writeFileSync(op.path, op.contents, 'utf8');
    stats.write++;
    console.log('WRITE', rel);
    return;
  }

  if (!fs.existsSync(op.path)) {
    stats.missing++;
    console.warn('MISSING FILE', rel);
    return;
  }
  let text = fs.readFileSync(op.path, 'utf8');
  if (op.replace_all) {
    if (!text.includes(op.old_string)) {
      stats.skip++;
      console.warn('SKIP (no match all)', rel);
      return;
    }
    text = text.split(op.old_string).join(op.new_string);
  } else {
    if (!text.includes(op.old_string)) {
      stats.skip++;
      console.warn('SKIP (no match)', rel);
      return;
    }
    text = text.replace(op.old_string, op.new_string);
  }
  fs.writeFileSync(op.path, text, 'utf8');
  stats.replace++;
  console.log('REPLACE', rel);
}

const raw = fs.readFileSync(transcriptPath, 'utf8');
const lines = raw.split('\n');
const ops = collectOps(lines);
console.log('Collected ops:', ops.length);

const stats = { write: 0, replace: 0, skip: 0, missing: 0, skipOutside: 0 };
for (const op of ops) applyOp(op, stats);

console.log('Done:', JSON.stringify(stats));
