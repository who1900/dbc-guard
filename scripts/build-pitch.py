"""Build the eight-slide DBC Guard product presentation."""
from pathlib import Path
import shutil
from html import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parents[1]
SLIDES = [
    ("01 / DBC GUARD", "Understand the launch.", [
        "Before you trade.",
        "A clear review of Meteora token launch choices, in one place. Explore a launch, understand its settings and share what you find.",
    ]),
    ("02 / THE PAIN", "Launch choices are hard to judge.", [
        "A token launch comes with choices about supply, trading fees and future liquidity.",
        "People need those choices explained clearly when deciding what to explore next.",
    ]),
    ("03 / THE SOLUTION", "An address becomes a clear review.", [
        "Paste a Meteora pool address. Read a structured review of the launch, with the underlying evidence close at hand.",
        "Share your findings with a link or a visual report.",
    ]),
    ("04 / WHY METEORA", "More choice deserves more clarity.", [
        "Meteora gives launch creators choices about how a token enters the market.",
        "DBC Guard makes those launch choices understandable, helping people explore the ecosystem with better context.",
    ]),
    ("05 / THE LANDSCAPE", "Different questions. Different tools.", [
        "Rugcheck: a token risk overview.",
        "DEX Screener: market activity and charts.",
        "Solscan: exploring on-chain records.",
        "DBC Guard: reviewing Meteora launch configuration.",
        "Our focus is the launch itself: making its choices easier to understand and discuss.",
    ]),
    ("06 / WORKING PRODUCT", "Open it. Explore a launch.", [
        "DBC Guard is live at dbc.whoim.space and works on desktop and mobile.",
        "Start with a pool address. Share a link, download a visual card or save the report. No account or wallet required.",
    ]),
    ("07 / THE FOUNDER", "Daniyar Gabdullin", [
        "Independent product builder.",
        "Creator of Seeker Vault and DBC Guard. Building practical products for people using Solana.",
        "Meet the founder on LinkedIn.",
    ]),
    ("08 / TRY DBC GUARD", "Clearer launches. Better context.", [
        "Explore a launch at dbc.whoim.space.",
        "Visit github.com/who1900/dbc-guard to follow the project.",
        "Our vision: make launch decisions easier to understand, compare and share across the Meteora community.",
    ]),
]


def build_pdf():
    destination = ROOT / "output/pdf/dbc-guard-pitch.pdf"
    destination.parent.mkdir(parents=True, exist_ok=True)
    width, height = 1280, 720
    pdf = canvas.Canvas(str(destination), pagesize=(width, height))
    pdf.setTitle("DBC Guard - Understand the launch")
    pdf.setAuthor("Daniyar Gabdullin")
    for label, title, paragraphs in SLIDES:
        pdf.setFillColor(HexColor("#fafaf3"))
        pdf.rect(0, 0, width, height, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#1a1a1a"))
        pdf.setFont("Courier", 15)
        pdf.drawString(70, 657, label)
        pdf.setFont("Helvetica-Bold", 44)
        pdf.drawString(70, 556, title)
        y = 455
        for paragraph in paragraphs:
            lines = simpleSplit(paragraph, "Helvetica", 30, 1110)
            pdf.setFont("Helvetica", 30)
            for line in lines:
                pdf.drawString(70, y, line)
                y -= 42
            y -= 26
        pdf.setFont("Courier", 13)
        pdf.drawString(70, 35, "DBC GUARD")
        pdf.linkURL("https://dbc.whoim.space", (70, 20, 650, 48), relative=0)
        if label.startswith("08"):
            pdf.linkURL("https://dbc.whoim.space", (70, 430, 1100, 495), relative=0)
            pdf.linkURL("https://github.com/who1900/dbc-guard", (70, 350, 1100, 425), relative=0)
        if label.startswith("07"):
            pdf.linkURL("https://www.linkedin.com/in/daniyar-gabdullin-11312b252/", (70, 260, 1100, 305), relative=0)
        pdf.showPage()
    pdf.save()
    public = ROOT / "public/submission"
    public.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destination, public / destination.name)
    shutil.copyfile(ROOT / "submission/index.html", public / "index.html")
    shutil.copyfile(ROOT / "submission/copy-fields.js", public / "copy-fields.js")
    sections = "".join(
        f'<section><small>{escape(label)}</small><h1>{escape(title)}</h1>'
        + "".join(f'<p>{escape(p)}</p>' for p in paragraphs)
        + ('<p><a href="https://www.linkedin.com/in/daniyar-gabdullin-11312b252/">Daniyar on LinkedIn</a></p>' if label.startswith("07") else '')
        + '</section>'
        for label, title, paragraphs in SLIDES
    )
    html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DBC Guard pitch</title><style>body{margin:0;background:#fafaf3;color:#1a1a1a;font-family:Arial,sans-serif}section{box-sizing:border-box;min-height:100vh;padding:7vw;max-width:1400px;margin:auto;page-break-after:always}small{font-family:monospace}h1{font-size:clamp(32px,4vw,56px)}p{font-size:clamp(19px,2vw,28px);line-height:1.5;overflow-wrap:anywhere}nav{padding:20px}a{color:inherit}@media print{section{min-height:auto;height:100vh}}</style><nav><a href="https://dbc.whoim.space">Live application</a> · <a href="https://github.com/who1900/dbc-guard">Repository</a> · <a href="dbc-guard-pitch.pdf">PDF</a></nav>' + sections + '</html>'
    (public / "pitch.html").write_text(html, encoding="utf-8")
    print(destination)
    print(public / destination.name)


if __name__ == "__main__":
    build_pdf()
