"""Build the matching HTML and nine-slide PDF product presentation."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html-only", action="store_true")
    args = parser.parse_args()
    public = ROOT / "public/submission"
    public.mkdir(parents=True, exist_ok=True)
    from reportlab.graphics import renderSVG
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    qr = QrCodeWidget("https://dbc.whoim.space", barLevel="M")
    x1, y1, x2, y2 = qr.getBounds()
    drawing = Drawing(240, 240, transform=[240 / (x2 - x1), 0, 0, 240 / (y2 - y1), 0, 0])
    drawing.add(qr)
    assets = public / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    renderSVG.drawToFile(drawing, str(assets / "product-qr.svg"))
    shutil.copyfile(ROOT / "scripts/pitch-template.html", public / "pitch.html")
    shutil.copyfile(ROOT / "scripts/pitch-navigation.js", public / "pitch-navigation.js")
    if not args.html_only:
        runtime = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node"
        node = os.environ.get("PITCH_NODE") or shutil.which("node")
        if not node:
            raise RuntimeError("Node.js is required to export the PDF; set PITCH_NODE or install Node.js.")
        env = os.environ.copy()
        if "PLAYWRIGHT_MODULE" not in env and (runtime / "node_modules/playwright").exists():
            env["PLAYWRIGHT_MODULE"] = str(runtime / "node_modules/playwright")
        subprocess.run([node, str(ROOT / "scripts/export-pitch.cjs")], cwd=ROOT, env=env, check=True)
    print(public / "pitch.html")


if __name__ == "__main__":
    build()
