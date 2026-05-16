# 智能销售助手 · 移动端静态 HTML 原型

**Axure 式离线包**：`resources/` 公共样式脚本 + `pages/` 每屏独立 HTML，**无需启动服务**。

## 入口

1. 双击 **`页面目录.html`**（推荐）
2. 或双击 **`index.html`**
3. 或进入 **`pages/`** 打开任意单页

## 结构

```
mobile-static/
  index.html
  页面目录.html
  resources/
    css/app.css
    css/pages.css
    js/app.js
  pages/
    首页.html
    …
```

## 重新生成

```bash
node customer_service/scripts/generate-native-mobile-static.mjs
```

（不使用 npm run build:static；与 Vue 打包产物无关。）

数据为 Mock，页面间通过 `<a href>` 串联。
