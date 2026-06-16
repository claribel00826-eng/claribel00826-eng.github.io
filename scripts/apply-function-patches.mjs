#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PATCH_DIR = path.join(ROOT, '_patches');
const SKILLS = path.join(ROOT, 'v1.3.0/js/skills.js');

const order = [
  'renderDeliverySourceCard',
  'renderDeliveryOrderPickCard',
  'renderDeliveryQuotePickCard',
  'beginDeliveryFromQuote',
  'deliveryOpenFormForOrder',
  'openDeliveryForm',
  'renderDeliveryFormCard',
  'renderDeliveryLinesProcessSection',
  'formatDeliveryBlockerLine',
  'demandSkipActionForSpec',
  'demandSubmitActionForSpec',
  'renderCopyDemandPromptCard',
  'renderHistoricalOrderPickCard',
  'renderOrderPickCard',
  'pushCopyOrderPickCard',
  'runCopy',
  'runChange',
  'runProgress',
  'openChangeSheet',
  'pushOrderProgressDetail',
  'skipQuoteDemandToPick',
  'runCapacity',
  'runInventory',
  'inventoryProductsForCustomer',
  'runPayment',
  'isViewSchemeHistoryPhrase'
];

let text = fs.readFileSync(SKILLS, 'utf8');
const stats = { ok: 0, skip: 0, missing: 0 };

for (const fn of order) {
  const oldPath = path.join(PATCH_DIR, fn + '.old.txt');
  const newPath = path.join(PATCH_DIR, fn + '.new.txt');
  if (!fs.existsSync(oldPath) || !fs.existsSync(newPath)) {
    stats.missing++;
    console.warn('MISSING', fn);
    continue;
  }
  const oldStr = fs.readFileSync(oldPath, 'utf8');
  const newStr = fs.readFileSync(newPath, 'utf8');
  if (!text.includes(oldStr)) {
    stats.skip++;
    console.warn('SKIP', fn);
    continue;
  }
  text = text.replace(oldStr, newStr);
  stats.ok++;
  console.log('OK', fn);
}

fs.writeFileSync(SKILLS, text, 'utf8');
console.log(JSON.stringify(stats));
