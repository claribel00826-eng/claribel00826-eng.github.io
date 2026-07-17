# PC 端 · v1.0.0

本目录为 **销售助手 PC 管理端** 独立版本，与 H5 演示目录（`v1.5.0/` 等）并列，不混入移动端原型。

## 本版范围

| 功能 | 说明 |
|------|------|
| **意图识别 QA 对维护** | 维护主功能口语映射（Q→A），导出供 H5 构建 `intent-qa.generated.js` |

## 文档

- [功能描述-意图QA对维护-v1.0.0.md](./功能描述-意图QA对维护-v1.0.0.md)

## 与 H5 的关系

```
pc-v1.0.0（维护）  →  导出 Excel / JSON
                              ↓
v1.5.0/scripts/build-intent-qa.py  →  v1.5.0/js/intent-qa.generated.js
                              ↓
v1.5.0/js/intent-match.js（运行时 L0 召回）
```

PC 端 **不替代** H5 意图路由全量规则（卡片级、槽位、交互模式）；仅维护 **L0 主功能 QA 词典**。
