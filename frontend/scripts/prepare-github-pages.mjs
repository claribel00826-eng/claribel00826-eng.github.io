/**
 * GitHub Pages：SPA 回退（404.html）并禁用 Jekyll。
 * 在 `npm run build` 之后执行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const index = path.join(dist, 'index.html')

if (!fs.existsSync(index)) {
  console.error('prepare-github-pages: dist/index.html 不存在，请先 npm run build')
  process.exit(1)
}

fs.copyFileSync(index, path.join(dist, '404.html'))
fs.writeFileSync(path.join(dist, '.nojekyll'), '')
console.log('prepare-github-pages: 已写入 dist/404.html 与 dist/.nojekyll')
