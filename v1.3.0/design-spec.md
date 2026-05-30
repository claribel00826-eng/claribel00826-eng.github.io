# 设计规范 · v1.3.0

> **继承** [../shared/design-spec.md](../shared/design-spec.md) 与 [v1.2.0/design-spec.md](../v1.2.0/design-spec.md)。  
> **本版增量**：交期结果卡、订单进度时间轴、变更成功态。

## 本版业务组件

- **交期**：`sc-card--inline-form`；表单字段纵向排列，日期字段成对（开始/结束）可用 `sc-field-row--2col`。
- **采购计划**：`sc-radio-group` 或 `sc-switch`（是/否）。
- **工艺版本**：`select.sc-input--field`，与下单明细工艺版本枚举一致。
- **订单选单**：复用待跟进列表行样式 `sc-follow-row`，列表外包 `sc-card--compact`。
- **进度时间轴**（新增）：
  - 容器：`sc-timeline`
  - 节点：`sc-timeline__item`，已完成 `sc-timeline__item--done`，当前 `sc-timeline__item--current`
  - 竖线：左侧 2px `var(--border)`，当前节点圆点 `var(--primary)`

## 状态色

- 交期按期 / 无法按时交付：`sc-badge--new` / `sc-badge--old`
- **订单类型**（v1.3.0）：

| 类型 | 类名 |
|------|------|
| 未审核 | `sc-badge--muted` |
| 销售审核 | `sc-badge--primary`（实心主色） |
| 已审核 | `sc-badge--new` |
| 已完成 | `sc-badge--done` |
| 异常 | `sc-badge--old` |

实现时在 `main.css` 补充 `--muted` / `--done` 徽章样式（若尚未存在）。
