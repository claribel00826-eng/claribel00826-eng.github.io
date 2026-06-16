const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(process.argv[2], 'utf8');
try {
  new vm.Script(code, { filename: 'skills.js' });
  console.log('OK');
} catch (e) {
  console.log(e.stack);
}
