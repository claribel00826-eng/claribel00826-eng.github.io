const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../js/annotation-spec-data.js');
const raw = fs.readFileSync(p, 'utf8');
const legacy = raw.match(/\/\*\* 兼容[\s\S]*$/)[0];
global.window = global;
eval(raw.replace(/\/\*\* 兼容[\s\S]*$/, ''));
const data = global.AnnotationSpecData;
const lines = [
  '/** v1.2.0 · 面板三层：layoutDisplay / buttons / persist（见 .output/标注编写规范.md） */',
  '',
  'window.AnnotationSpecData = {'
];
const keys = Object.keys(data);
keys.forEach((key, i) => {
  const e = data[key];
  const layoutDisplay = []
    .concat(e.layoutDisplay || [])
    .concat(e.layout || [])
    .concat(e.displayQuery || []);
  lines.push(`  '${key}': {`);
  lines.push(`    name: ${JSON.stringify(e.name)},`);
  lines.push(`    module: ${JSON.stringify(e.module)},`);
  lines.push('    layoutDisplay: ' + JSON.stringify(layoutDisplay, null, 2).replace(/\n/g, '\n    ') + ',');
  lines.push('    buttons: ' + JSON.stringify(e.buttons || [], null, 2).replace(/\n/g, '\n    ') + (e.persist && e.persist.length ? ',' : ''));
  if (e.persist && e.persist.length) {
    lines.push('    persist: ' + JSON.stringify(e.persist, null, 2).replace(/\n/g, '\n    '));
  }
  if (e.extraHtml) {
    lines.push('    extraHtml: ' + JSON.stringify(e.extraHtml));
  }
  lines.push('  }' + (i < keys.length - 1 ? ',' : ''));
});
lines.push('};');
lines.push('');
lines.push(legacy);
fs.writeFileSync(p, lines.join('\n'));
console.log('merged', keys.length, 'entries');
