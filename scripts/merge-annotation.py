from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
v12 = (ROOT / "v1.2.0/js/annotation-spec-data.js").read_text(encoding="utf-8")
v13 = (ROOT / "v1.3.0/js/annotation-spec-data.js").read_text(encoding="utf-8")
m = re.search(r"  'card-delivery-entry':.*\n};\s*$", v13, re.DOTALL)
extra = m.group(0).rstrip()
extra = extra[:-2].rstrip()
v12 = v12.rstrip()
if v12.endswith("};"):
    v12 = v12[:-2].rstrip() + ",\n" + extra + "\n};\n"
(ROOT / "v1.3.0/js/annotation-spec-data.js").write_text(v12, encoding="utf-8")
print("annotation merged", len(v12.splitlines()), "lines")
