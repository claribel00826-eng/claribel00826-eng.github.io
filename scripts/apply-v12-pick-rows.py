#!/usr/bin/env python3
"""Apply v1.2 free-attr pick rows + order confirm body onto current v1.3 skills.js."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V12 = ROOT / "v1.2.0/js/skills.js"
V13 = ROOT / "v1.3.0/js/skills.js"

FUNCS = [
    "ensurePlanSku",
    "planPickRow",
    "ensureQuoteSku",
    "quotePickRow",
    "ensureOrderSku",
    "orderPickRow",
    "renderOrderConfirmBody",
    "renderOrderConfirmCard",
    "applyQuoteLineCommercialDefaults",
    "renderQuoteLineConfigRow",
    "syncQuotePendingFromDom",
    "onPickFreeAttrChange",
]


def read(p):
    return p.read_text(encoding="utf-8")


def extract_function_block(text, name):
    m = re.search(rf"^  function {re.escape(name)}\([^)]*\) \{{", text, re.M)
    if not m:
        m = re.search(rf"^function {re.escape(name)}\([^)]*\) \{{", text, re.M)
    if not m:
        return None
    start = m.start()
    i = m.end()
    depth = 1
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    return text[start:i]


def replace_function(text, name, block):
    old = extract_function_block(text, name)
    if not old:
        print(f"missing in target: {name}")
        return text
    if old == block:
        print(f"unchanged: {name}")
        return text
    print(f"replaced: {name}")
    return text.replace(old, block, 1)


def main():
    v12 = read(V12)
    text = read(V13)
    for name in FUNCS:
        block = extract_function_block(v12, name)
        if block:
            text = replace_function(text, name, block)
        else:
            print(f"missing in v12: {name}")

    if "action === 'pick-free-attr'" not in text:
        needle = "    if (action === 'plan-toggle' && pid) {"
        insert = (
            "    if (action === 'pick-free-attr') {\n"
            "      onPickFreeAttrChange(btn);\n"
            "      return true;\n"
            "    }\n"
            + needle
        )
        if needle in text:
            text = text.replace(needle, insert, 1)
            print("added pick-free-attr handler")

    V13.write_text(text, encoding="utf-8")
    print(f"done ({len(text.splitlines())} lines)")


if __name__ == "__main__":
    main()
