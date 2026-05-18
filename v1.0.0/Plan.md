# 实现计划 · v1.0.0

> **版本目录**：`.output/v1.0.0/`（本文件为唯一进度源）  
> **可运行入口**：[index.html](./index.html) · 索引页 [../index.html](../index.html)  
> **公共资产**：[../shared/](../shared/)

## 目标

交付可双击运行的 H5 原型；**标注必须先文档、后落页**。

## 本版本目录结构

```
v1.0.0/
├── PRD.md
├── design-spec.md          # 继承 shared/design-spec.md
├── Plan.md                 # 本文件
├── prototypes/             # 阶段 B2 原型（历史）
├── annotation-docs/
├── index.html
├── css/
├── js/
└── _archive/               # 过程稿（如 ui-design-spec.md）
```

## 标注工作流

```
annotation-docs/ 用户确认
    → js/annotation-spec-data.js
    → index.html + app.js（data-spec-id）
    → ?spec=1 抽验
```

## 进度

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | `index.html` 壳 + 路由 | ✅ |
| 2 | `css/main.css` | ✅ |
| 3 | `js/demo-data.js` | ✅ |
| 4 | `js/app.js` | ✅ |
| 5 | `js/skills.js` | ✅ |
| 6A | 标注文档 01-首页与待跟进 | ✅ |
| 6B | 落页标注（spec 面板 + 钉） | ✅ |
| 6C | 其余模块标注文档 | 未开始 |
| 7 | 功能 + 标注整体验收 | 进行中 |

## 标注文档索引

| 编号 | 文件 | 范围 | 文档 | 落页 |
|------|------|------|------|------|
| 01 | [annotation-docs/01-首页与待跟进.md](./annotation-docs/01-首页与待跟进.md) | 顶栏、待跟进、写跟进等 | ✅ | ✅ |

## 功能验收清单

- [x] 打开即对话页（演示无登录墙）
- [x] 首屏：欢迎、待跟进摘要、最近访问
- [x] 待跟进全链路 + 写跟进（含提醒日期）
- [x] 意图填槽标注（全局 + 表单槽）
- [x] 未选客户时清空记录禁用
- [ ] `?spec=1` 全模块抽验通过

## V2+（下一版本目录规划）

见 [PRD.md](./PRD.md) §3；新版本从本目录**整目录复制**为 `v1.1.0/` 后迭代。
