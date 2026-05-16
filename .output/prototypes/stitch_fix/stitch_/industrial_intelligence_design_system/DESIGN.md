---
name: Industrial Intelligence Design System
colors:
  surface: '#fcf8fa'
  surface-dim: '#dcd9db'
  surface-bright: '#fcf8fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45464d'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#fcf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  h1:
    fontFamily: PingFang SC
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  h2:
    fontFamily: PingFang SC
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  h3:
    fontFamily: PingFang SC
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-main:
    fontFamily: PingFang SC
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-secondary:
    fontFamily: PingFang SC
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: PingFang SC
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  number-data:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-padding: 16px
  stack-gap: 12px
  inline-gap: 8px
  section-margin: 24px
---

## Brand & Style

此设计系统专为制造业 B2B 环境下的微信 H5 智能销售助手打造。核心性格定位为**稳重、高效、理性**。在移动端 WebView 环境中，它必须超越一般的社交应用观感，建立如同桌面端专业软件般的“工业级”可信度。

设计风格采用 **Modern Corporate (现代企业风)**。通过严谨的排版、深邃的色调以及克制的装饰细节，传达出一种精密感。界面通过大量清晰的留白（Negative Space）来缓解制造业复杂数据的压迫感，确保销售人员在快节奏的沟通过程中能够迅速捕捉关键参数与业务状态。

## Colors

色彩策略侧重于信息层级的深度。
- **主色 (#0F172A)**：采用极深的靛蓝色作为品牌基调，象征制造业的厚重与数字化的深邃。
- **行动色 (#0369A1)**：明亮的蓝色用于关键操作（CTA）和链接，在深色背景中具有极高的识别度。
- **中性色群**：从正文的墨黑色 (#020617) 到次级文字的灰石色 (#334155)，再到页面的背景色 (#F8FAFC)，建立了细腻的对比度梯度，确保长时间阅读文档或报表时不产生视觉疲劳。
- **语义色**：警告、危险与成功色均经过低饱和度处理，保持专业感的同时，准确传达库存状态、逾期提醒等业务信号。

## Typography

针对微信 H5 环境，优先使用系统内置的 **PingFang SC** 以保证渲染性能与清晰度。
- **层级结构**：使用加粗的 H1/H2 作为页面大标题，突出当前业务模块。
- **数据展示**：对于金额、库存量等关键数字，建议调用 **Inter** 或 **Manrope** 的半粗体（Semi-bold），增加数字的可读性与现代感。
- **正文标准**：主要交互内容保持在 16px，辅助信息不低于 12px。
- **行高优化**：采用 1.5 倍左右的行高，以适应制造业中常见的长文本描述（如产品技术规格）。

## Layout & Spacing

采用基于 **4px** 的步进式间距系统，确保所有元素在 390x844 的视口中严丝合缝。
- **容器布局**：页面左右安全边距固定为 16px。
- **列表与堆叠**：列表项之间使用 12px 的间距，既保持了信息的独立性，又能在单屏内承载更多内容。
- **卡片内部**：卡片内衬通常为 16px，但在展示复杂表格数据时可缩小至 12px 以提升信息密度。
- **适配性**：考虑到微信 WebView 的顶部导航栏和底部手势区，关键操作按钮应保持在底部安全区域上方 20px 处。

## Elevation & Depth

由于该系统强调“信息优先”和“专业感”，设计避免使用大面积的投影。
- **层级逻辑**：主要通过背景色 (#F8FAFC) 与卡片色 (#FFFFFF) 的对比来区分层级，而非依赖深度。
- **轻阴影 (Soft Shadow)**：仅在浮动动作按钮（FAB）或需要强调的弹出层（Modal）上使用极其克制的阴影：`box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08)`。
- **线性分割**：利用 1px 的边框 (#E2E8F0) 作为主要的数据区块分割手段，模仿工业图表的精确性。

## Shapes

形状语言在“友好”与“严谨”之间取得平衡：
- **容器与卡片**：使用 12px 圆角。这种中等幅度的圆角能有效软化工业数据的冷冰冰感，同时在移动端屏幕上显得自然。
- **交互组件**：按钮采用 10px 圆角，输入框采用 8px 圆角。这种微小的曲率变化有助于在视觉上区分“展示容器”与“交互控件”。
- **状态标签**：使用全圆角（Pill-shaped）来标识状态（如“待发货”），以利用形状特征快速吸引注意力。

## Components

### 1. 按钮 (Buttons)
- **Primary**: 主色背景 (#0F172A)，白色文字，10px 圆角。点击态为 90% 透明度。
- **Ghost**: 行动色边框 (#0369A1) 与文字，背景透明。用于次要操作，如“查看详情”。

### 2. 卡片 (Cards)
- 白色背景 (#FFFFFF)，1px 灰色边框 (#E2E8F0)，12px 圆角。
- 标题区与内容区通过水平线分割，标题左侧可带有 3px 宽的主色装饰条以强化引导。

### 3. 表单与输入 (Forms)
- 输入框使用 8px 圆角，内边距 12px，占位符使用次级文字色。
- 激活状态下，边框颜色转为行动色 (#0369A1)，并带有微弱的蓝色外发光。

### 4. 数据列表 (Data Lists)
- 每一行高度固定（Min 56px），左右对齐。
- 右侧使用 1.5px 粗细的线性 SVG 箭头标识可跳转。

### 5. 图标 (Icons)
- 统一使用 24x24px 容器，描边宽度 1.5px 或 2px。
- 风格为 Outline（线性），避免使用填充，以保持界面的轻量感。

### 6. 业务特有组件
- **参数规格表 (Spec Sheet)**：采用斑马纹设计的简洁表格，首列背景稍深。
- **库存状态指示器 (Status Pill)**：背景为语义色的 10% 透明度版本，文字为语义色加粗。