import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** npm run build:static → 单文件内联 + Hash 路由，空白电脑双击即可打开（无 Node / 无本地服务） */
  const isStaticExport = env.VITE_STATIC_EXPORT === 'true'

  return {
    base: isStaticExport ? './' : '/',
    server: isStaticExport
      ? undefined
      : {
          /** 允许 Cloudflare/ngrok 等隧道域名访问开发服 */
          allowedHosts: true,
        },
    plugins: [vue(), ...(isStaticExport ? [viteSingleFile()] : [])],
    define: isStaticExport
      ? {
          'import.meta.env.VITE_STATIC_EXPORT': JSON.stringify('true'),
          'import.meta.env.MODE': JSON.stringify('static'),
          'import.meta.env.DEV': 'false',
          'import.meta.env.PROD': 'true',
        }
      : undefined,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: isStaticExport
      ? {
          cssCodeSplit: false,
          assetsInlineLimit: Number.POSITIVE_INFINITY,
          modulePreload: false,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              /** 避免产物残留 import.meta.url（file:// 非 module 脚本会报错） */
              format: 'iife',
              name: 'CustomerServiceH5',
            },
          },
        }
      : undefined,
  }
})
