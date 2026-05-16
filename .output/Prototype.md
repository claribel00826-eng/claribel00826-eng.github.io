# 原型汇总说明（阶段 B2）

> 工具：Stitch  
> 最新 ZIP：`.output/prototypes/stitch_ (2).zip`  
> 最新解压目录：`.output/prototypes/stitch_/`  
> 依据：`.output/ui-design-spec.md`（B1-6）、`.output/stitch-prompts.md`（B2-6）

---

## 1. 文件结构

最新 Stitch 导出包含 20 个页面目录，每个目录包含：

- `code.html`：页面 HTML / Tailwind 原型代码
- `screen.png`：页面截图

另含：

- `.output/prototypes/stitch_/industrial_intelligence_design_system/DESIGN.md`

---

## 2. 页面映射

| 序号 | PRD 页面 | 原型目录 | HTML | 截图 |
|------|----------|----------|------|------|
> 注意：Stitch 第二次导出的页面顺序与提示词顺序不完全一致，下表以页面实际内容为准。

| 序号 | 实际页面 | 原型目录 | HTML | 截图 |
|------|----------|----------|------|------|
| 1 | P02 首页 | `_1` | `.output/prototypes/stitch_/_1/code.html` | `.output/prototypes/stitch_/_1/screen.png` |
| 2 | P01 登录 / 授权中转 | `_2` | `.output/prototypes/stitch_/_2/code.html` | `.output/prototypes/stitch_/_2/screen.png` |
| 3 | P06 客户开拓 - 跟进提交 | `_3` | `.output/prototypes/stitch_/_3/code.html` | `.output/prototypes/stitch_/_3/screen.png` |
| 4 | P03 待跟进客户列表 | `_4` | `.output/prototypes/stitch_/_4/code.html` | `.output/prototypes/stitch_/_4/screen.png` |
| 5 | P09 生成方案 - 预览与保存 | `_5` | `.output/prototypes/stitch_/_5/code.html` | `.output/prototypes/stitch_/_5/screen.png` |
| 6 | P08 购物车 | `_6` | `.output/prototypes/stitch_/_6/code.html` | `.output/prototypes/stitch_/_6/screen.png` |
| 7 | P07 产品推荐 | `_7` | `.output/prototypes/stitch_/_7/code.html` | `.output/prototypes/stitch_/_7/screen.png` |
| 8 | P12 交期评审 | `_8` | `.output/prototypes/stitch_/_8/code.html` | `.output/prototypes/stitch_/_8/screen.png` |
| 9 | P13 生成订单 | `_9` | `.output/prototypes/stitch_/_9/code.html` | `.output/prototypes/stitch_/_9/screen.png` |
| 10 | P18 订单进度列表 | `_10` | `.output/prototypes/stitch_/_10/code.html` | `.output/prototypes/stitch_/_10/screen.png` |
| 11 | P20 客户服务 | `_11` | `.output/prototypes/stitch_/_11/code.html` | `.output/prototypes/stitch_/_11/screen.png` |
| 12 | P05 客户开拓 - 待跟进列表 | `_12` | `.output/prototypes/stitch_/_12/code.html` | `.output/prototypes/stitch_/_12/screen.png` |
| 13 | P10 生成方案 - 入口 | `_13` | `.output/prototypes/stitch_/_13/code.html` | `.output/prototypes/stitch_/_13/screen.png` |
| 14 | P04 客户选择器 | `_14` | `.output/prototypes/stitch_/_14/code.html` | `.output/prototypes/stitch_/_14/screen.png` |
| 15 | P11 生成报价 | `_15` | `.output/prototypes/stitch_/_15/code.html` | `.output/prototypes/stitch_/_15/screen.png` |
| 16 | P14 调整方案引导 | `_16` | `.output/prototypes/stitch_/_16/code.html` | `.output/prototypes/stitch_/_16/screen.png` |
| 17 | P15 插单申请 | `_17` | `.output/prototypes/stitch_/_17/code.html` | `.output/prototypes/stitch_/_17/screen.png` |
| 18 | P16 订单复制 | `_18` | `.output/prototypes/stitch_/_18/code.html` | `.output/prototypes/stitch_/_18/screen.png` |
| 19 | P17 订单变更 | `_19` | `.output/prototypes/stitch_/_19/code.html` | `.output/prototypes/stitch_/_19/screen.png` |
| 20 | P19 订单进度详情 | `_20` | `.output/prototypes/stitch_/_20/code.html` | `.output/prototypes/stitch_/_20/screen.png` |

---

## 3. 一致性抽检结果

### 已通过（第二版 ZIP）

- ZIP 已解压，20 个 `code.html` 与 20 个 `screen.png` 均存在。
- 全局搜索未发现「销售概览 / 客户中心 / 智能助手 / 个人中心」底部导航。
- 全局搜索未发现「AI 建议 / 根据 AI / 智能建议 / AI 重新选配」等已禁用文案。
- 全局搜索未发现销售额、转化率、成交率、回款率、业绩目标、销售排行、漏斗图、趋势图等禁用经营指标。
- 全局搜索未发现「待交期」「插单 1」等首页统计残留。
- 首页实际内容位于 `_1`，已包含 11 个功能入口。
- 客户开拓相关页面 `_4` / `_12` 已围绕「老客户超时」「公海新客户」两类待跟进客户。

### 仍需修正 / 待确认偏差（第二版 ZIP）

1. **客户选择页仍有「智能推荐」扩展**
   - `_14` 出现「智能推荐 / 根据您的销售习惯，优先展示近期有过联系的 5 位客户」。
   - 该内容超出 PRD 范围，且容易引入算法推荐/销售习惯分析。
   - 已在 `.output/stitch-prompts.md` B2-6 中补充禁止。

2. **调整方案页仍有英文可见标识**
   - `_16` 出现「PROPOSAL MANAGEMENT」与「B2B Manufacturing Assistant v2.4」。
   - 已在 `.output/stitch-prompts.md` B2-6 中补充禁止。

3. **订单进度页存在额外统计扩展**
   - `_10` 出现「当前生产负荷 / 本周待交付 / 准时率」。
   - 虽不是销售额/转化率，但仍属于 PRD 未定义的统计扩展。
   - 已在 `.output/stitch-prompts.md` B2-6 中补充禁止。

4. **订单进度详情页存在扩展模块**
   - `_20` 出现「物流概览 / 联系生产主管」。
   - PRD 仅要求订单与产品进度查询，未要求物流或联系主管入口。
   - 已在 `.output/stitch-prompts.md` B2-6 中补充禁止。

---

## 4. B2 结论

当前第二版 Stitch 原型已经解决上一轮两个核心偏差（底部全局导航、AI 建议），但仍有少量 Stitch 自行扩展内容，不建议作为最终确认版进入阶段 C。建议重生成以下受影响页面：

1. `_10` 订单进度列表
2. `_14` 客户选择器
3. `_16` 调整方案引导
4. `_20` 订单进度详情

为避免下次生成再次出现同类偏差，已同步强化：

- `.output/stitch-prompts.md` → `B2-6`
- `.output/ui-design-spec.md` → `B1-6`

---

## 5. 待确认

请确认处理方式：

- **建议**：用新版 `stitch-prompts.md` 重新生成仍有偏差的页面（订单进度列表、客户选择器、调整方案引导、订单进度详情）。

未经确认，不进入阶段 C。

---

## 6. 第三版局部重生成检查

> ZIP：`.output/prototypes/stitch_ (3).zip`  
> 解压目录：`.output/prototypes/stitch_fix/stitch_/`

### 已通过页面

- `_3`：首页，未出现底部全局导航、经营指标、待交期/插单统计。
- `_2`：订单复制，未发现本轮禁用项。
- `_5`：客户服务，允许出现意图识别与摘要，未发现底部全局导航。

### 仍需重生成页面

1. `_1`：订单进度列表
   - 仍出现「当前生产负荷」「本周待交付」「准时率」统计。
   - 已在 `.output/stitch-prompts.md` B2-7 中强化禁止。

2. `_4`：产品推荐
   - 仍出现「智能推荐」标题。
   - 已在 `.output/stitch-prompts.md` B2-7 中强化：标题只能用「产品推荐」或「推荐产品」。

### 当前建议

只需继续重生成：

- `§7 P07 — 产品推荐`
- `§18 P18 — 订单进度列表`

其余第三版页面可作为可用参考。

