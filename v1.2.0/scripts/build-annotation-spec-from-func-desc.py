#!/usr/bin/env python3
"""从功能描述文档生成 annotation-spec-data.js 中 02 模块条目（逐字复刻，不增删改）。"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "功能描述-方案报价下单-v1.2.0.md"
OUT = ROOT / "js" / "_annotation-spec-module-02.generated.js"

SPECS: list[tuple[str, str, str, list[str]]] = [
    ("card-plan-entry", "1.2.1", "方案速配 · 入口卡", ["1.2.1"]),
    ("card-scheme-pick", "1.2.2、1.3.3.2", "历史方案列表 / 选择方案卡", ["1.2.2", "1.3.3.2"]),
    ("card-plan-demand", "1.2.3.1", "需求引导卡片", ["1.2.3.1"]),
    ("card-plan-pick", "1.2.3.2", "方案选品卡", ["1.2.3.2"]),
    ("card-plan-preview", "1.2.3.3", "方案预览卡", ["1.2.3.3"]),
    ("sheet-plan-template", "1.2.3.4", "方案模板选择卡", ["1.2.3.4"]),
    ("card-scheme", "1.2.3.5", "方案卡", ["1.2.3.5"]),
    ("modal-pdf", "1.2.3.5、1.3.3.8", "PDF 预览", ["1.2.3.5_pdf", "1.3.3.8_pdf"]),
    ("card-quote-entry", "1.3.1", "产品报价 · 入口卡", ["1.3.1"]),
    ("card-quote-select", "1.3.2、1.4.4", "历史报价单列表 / 选择报价单卡", ["1.3.2", "1.4.4"]),
    ("card-quote-source", "1.3.3.1", "报价来源卡", ["1.3.3.1"]),
    ("card-quote-demand", "1.3.3.3", "需求引导卡片（直选报价）", ["1.2.3.1", "1.3.3.3"]),
    ("card-quote-pick", "1.3.3.4", "选品报价卡", ["1.2.3.2", "1.3.3.4"]),
    ("card-quote-cart", "1.3.3.5", "报价选品确认卡", ["1.3.3.5"]),
    ("sheet-quote-setup", "1.3.3.6", "逐项报价卡", ["1.3.3.6"]),
    ("sheet-quote-template", "1.3.3.7", "报价单模板选择卡", ["1.3.3.7"]),
    ("card-quote", "1.3.3.8", "报价单卡", ["1.3.3.8"]),
    ("card-order-entry", "1.4.1", "确认下单 · 入口卡", ["1.4.1"]),
    ("card-order-select", "1.4.2", "历史订单列表", ["1.4.2"]),
    ("card-order", "1.4.2.1", "订单卡", ["1.4.2.1"]),
    ("card-order-source", "1.4.3", "下单来源卡", ["1.4.3"]),
    ("card-order-pick", "1.4.5", "订单选品卡", ["1.2.3.2", "1.4.5"]),
    ("card-order-cart", "1.4.6", "订单购物车卡", ["1.4.6"]),
    ("sheet-order", "1.4.7", "下单确认卡", ["1.4.7"]),
    ("card-order-success", "1.4.8", "订单成功卡", ["1.4.8"]),
]


def read_src() -> str:
    return SRC.read_text(encoding="utf-8")


def strip_doc_header(text: str) -> str:
    m = re.search(r"^## 1\.2 方案速配", text, re.M)
    if not m:
        raise SystemExit("cannot find ## 1.2")
    return text[m.start() :]


def extract_section(body: str, key: str) -> str:
    if key == "1.2.3.5_pdf":
        block = extract_section(body, "1.2.3.5")
        idx = block.find("**操作**：")
        return block[idx:].strip()
    if key == "1.3.3.8_pdf":
        block = extract_section(body, "1.3.3.8")
        idx = block.find("**操作**：")
        return block[idx:].strip()

    patterns = {
        "1.2.1": r"### 1\.2\.1 入口卡\n",
        "1.2.2": r"### 1\.2\.2 历史方案列表\n",
        "1.2.3.1": r"#### 1\.2\.3\.1 需求引导卡片\n",
        "1.2.3.2": r"#### 1\.2\.3\.2 选品卡\n",
        "1.2.3.3": r"#### 1\.2\.3\.3 方案预览卡\n",
        "1.2.3.4": r"#### 1\.2\.3\.4 方案模板选择卡\n",
        "1.2.3.5": r"#### 1\.2\.3\.5 方案卡\n",
        "1.3.1": r"### 1\.3\.1 入口卡\n",
        "1.3.2": r"### 1\.3\.2 历史报价单列表\n",
        "1.3.3.1": r"#### 1\.3\.3\.1 报价来源卡\n",
        "1.3.3.2": r"#### 1\.3\.3\.2 选择方案卡[^\n]*\n",
        "1.3.3.3": r"#### 1\.3\.3\.3 需求引导卡片[^\n]*\n",
        "1.3.3.4": r"#### 1\.3\.3\.4 选品报价卡\n",
        "1.3.3.5": r"#### 1\.3\.3\.5 报价选品确认卡[^\n]*\n",
        "1.3.3.6": r"#### 1\.3\.3\.6 逐项报价卡\n",
        "1.3.3.7": r"#### 1\.3\.3\.7 报价单模板选择卡\n",
        "1.3.3.8": r"#### 1\.3\.3\.8 报价单卡\n",
        "1.4.1": r"### 1\.4\.1 入口卡\n",
        "1.4.2": r"### 1\.4\.2 历史订单列表\n",
        "1.4.2.1": r"#### 1\.4\.2\.1 订单卡\n",
        "1.4.3": r"### 1\.4\.3 下单来源卡\n",
        "1.4.4": r"### 1\.4\.4 选择报价单卡[^\n]*\n",
        "1.4.5": r"### 1\.4\.5 订单选品卡[^\n]*\n",
        "1.4.6": r"### 1\.4\.6 订单购物车卡[^\n]*\n",
        "1.4.7": r"### 1\.4\.7 下单确认卡\n",
        "1.4.8": r"### 1\.4\.8 订单成功卡\n",
    }
    pat = patterns[key]
    m = re.search(pat, body)
    if not m:
        raise SystemExit(f"section not found: {key}")
    tail = body[m.end() :]
    nxt = re.search(
        r"\n(?:### 1\.|#### 1\.|## 1\.3 |## 1\.4 |## 附录|---\n\n## )",
        tail,
    )
    end = m.end() + nxt.start() if nxt else len(body)
    return body[m.start() : end].strip()


def lines_from_section(section: str) -> list[str]:
    out: list[str] = []
    for ln in section.splitlines():
        s = ln.rstrip()
        if s == "---":
            continue
        if re.match(r"^#{1,6} ", s):
            continue
        if s:
            out.append(s)
    return out


def js_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def emit_entry(spec_id: str, module: str, name: str, keys: list[str], body: str) -> str:
    content: list[str] = []
    for k in keys:
        content.extend(lines_from_section(extract_section(body, k)))
    lines = [f"  '{spec_id}': {{"]
    lines.append(f"    name: {js_string(name)},")
    lines.append(f"    module: {js_string(module)},")
    lines.append("    content: [")
    for item in content:
        lines.append(f"      {js_string(item)},")
    lines.append("    ],")
    lines.append("    query: [],")
    lines.append("    interaction: [],")
    lines.append("  },")
    return "\n".join(lines)


def main() -> None:
    body = strip_doc_header(read_src())
    chunks = [emit_entry(sid, mod, name, keys, body) for sid, mod, name, keys in SPECS]
    OUT.write_text("\n".join(chunks) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(chunks)} entries)")


if __name__ == "__main__":
    main()
