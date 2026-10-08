"""Build the editable PowerPoint deck and export its matching PDF in native Office."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pptx-only", action="store_true", help="Skip native PowerPoint PDF export")
    parser.add_argument("--render-slides", action="store_true", help="Export native Office PNG previews for QA")
    args = parser.parse_args()
    node = os.environ.get("PITCH_NODE") or shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is required; set PITCH_NODE or install Node.js.")
    subprocess.run([node, str(ROOT / "scripts/build-pitch-pptx.cjs")], cwd=ROOT, check=True)
    if not args.pptx_only:
        powershell = shutil.which("powershell") or shutil.which("pwsh")
        if not powershell:
            raise RuntimeError("Windows with native PowerPoint is required for PDF export. PPTX was built successfully.")
        command = [powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "scripts/export-pitch-office.ps1")]
        if args.render_slides:
            command.append("-RenderSlides")
        subprocess.run(command, cwd=ROOT, check=True)


if __name__ == "__main__":
    build()
