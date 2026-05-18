# 跨版本公共资产（shared）

本目录存放**多版本共用**、且不宜只存在于某一版本快照的内容。

## 文件说明

| 文件 | 用途 |
|------|------|
| [competitive-analysis.md](./competitive-analysis.md) | 阶段 R 竞品调研结论 |
| [architecture.md](./architecture.md) | 功能架构与核心链路说明 |
| [design-spec.md](./design-spec.md) | 全局 UI token 基线（色板、字体、间距、圆角） |

## 引用与修改

- 各版本在 `PRD.md` / `design-spec.md` 文首注明是否**继承**本目录。
- 若**仅某一新版本**需改视觉：将 `design-spec.md` **复制**到该版本目录再改，**不要**直接改 shared（避免影响已冻结旧版本）。
- 已交付版本目录原则上不再修改；迭代在新 `v*` 目录进行。

## 版本入口

- [版本索引](../index.html)  
- 当前可运行原型：[v1.0.0](../v1.0.0/index.html)
