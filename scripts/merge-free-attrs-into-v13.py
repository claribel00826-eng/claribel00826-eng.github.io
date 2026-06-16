#!/usr/bin/env python3
"""Inject v1.2 free-attr + order-confirm helpers into restored v1.3 skills.js."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V12 = ROOT / "v1.2.0/js/skills.js"
V13 = ROOT / "_v13_restored_skills.js"
OUT = ROOT / "v1.3.0/js/skills.js"

# v1.2-only helpers (exclude deleted service / old change sheet)
V12_FUNCS = [
    "btnLabel",
    "ensurePickCustomAttrs",
    "pickDraftForScope",
    "renderPickFreeAttrRows",
    "renderPickSpecBlock",
    "renderQuoteLineQtyField",
    "syncPickCustomAttrsFromDom",
    "syncPickSkuFromCustomAttrs",
    "syncQuotePickCustomAttrsFromDom",
    "syncOrderPickCustomAttrsFromDom",
    "syncLineCustomAttrsFromDom",
    "onPickFreeAttrChange",
    "orderConfirmRoot",
    "renderOrderConfirmLineInfoGrid",
    "renderOrderConfirmLineFields",
    "renderOrderConfirmLineCard",
    "renderOrderConfirmHeaderMore",
    "toggleOrderHeaderMore",
    "applyOrderHeaderMoreOpenState",
    "syncOrderConfirmLinesFromDom",
    "refreshLastOrderConfirmCard",
    "finalizeOrderPendingLines",
    "enrichOrderLineStock",
]


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def extract_function_block(text: str, name: str) -> str | None:
    m = re.search(rf"^  function {re.escape(name)}\([^)]*\) \{{", text, re.M)
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


def replace_or_insert(text: str, name: str, block: str) -> str:
    old = extract_function_block(text, name)
    if old:
        return text.replace(old, block, 1)
    anchor = text.rfind("  return {")
    if anchor == -1:
        anchor = len(text)
    return text[:anchor] + block + "\n\n" + text[anchor:]


def patch_bind_pick_attrs(text: str, v12: str) -> str:
    """Copy bindPickCustomAttrListeners body fragment from v12 syncPickCustomAttrsFromDom area."""
    m12 = re.search(
        r"document\.querySelectorAll\('\[data-action=\"pick-free-attr\]",
        v12,
    )
    if not m12:
        return text
    # ensure pick-free-attr in delegated click handler
    if "action === 'pick-free-attr'" in text:
        return text
    m = re.search(
        r"(if \(action === 'pick-sku' && pid\)[^\n]+\n[^\n]+\n[^\n]+\n)",
        text,
    )
    if m:
        insert = (
            m.group(1)
            + "    if (action === 'pick-free-attr' && pid) {\n"
            + "      onPickFreeAttrChange(btn);\n"
            + "      return;\n"
            + "    }\n"
        )
        return text.replace(m.group(1), insert, 1)
    return text


def patch_exports(text: str) -> str:
    for name in ["onPickFreeAttrChange", "renderPickFreeAttrRows"]:
        if f"{name}," not in text and f"{name}\n" not in text:
            text = re.sub(
                r"(  return \{[^}]*)(  \};)",
                rf"\1    {name},\n\2",
                text,
                count=1,
                flags=re.S,
            )
    return text


def main():
    v12 = read(V12)
    text = read(V13)

    for name in V12_FUNCS:
        block = extract_function_block(v12, name)
        if not block:
            print(f"skip missing v12: {name}")
            continue
        text = replace_or_insert(text, name, block)
        print(f"merged: {name}")

  # renderQuoteLineBlock in v12 uses renderPickFreeAttrRows — swap function if v13 version lacks it
    v12_block = extract_function_block(v12, "renderQuoteLineBlock")
    v13_block = extract_function_block(text, "renderQuoteLineBlock")
    if v12_block and v13_block and "renderPickFreeAttrRows" in v12_block:
        text = text.replace(v13_block, v12_block, 1)
        print("merged: renderQuoteLineBlock")

    v12_order_line = extract_function_block(v12, "renderOrderLineBlock")
    v13_order_line = extract_function_block(text, "renderOrderLineBlock")
    if v12_order_line and v13_order_line and "renderPickFreeAttrRows" in v12_order_line:
        text = text.replace(v13_order_line, v12_order_line, 1)
        print("merged: renderOrderLineBlock")

    v12_confirm = extract_function_block(v12, "renderOrderConfirmCard")
    v13_confirm = extract_function_block(text, "renderOrderConfirmCard")
    if v12_confirm and v13_confirm and "renderOrderConfirmLineCard" in v12_confirm:
        text = text.replace(v13_confirm, v12_confirm, 1)
        print("merged: renderOrderConfirmCard")

    text = patch_bind_pick_attrs(text, v12)
    text = patch_exports(text)

    OUT.write_text(text, encoding="utf-8")
    print(f"written {OUT} ({len(text.splitlines())} lines)")


if __name__ == "__main__":
    main()
