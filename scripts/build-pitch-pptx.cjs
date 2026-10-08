const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const dependencies = process.env.PITCH_MODULES || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const load = name => { try { return require(name); } catch { return require(path.join(dependencies, name)); } };
const PptxGenJS = load('pptxgenjs');
const sharp = load('sharp');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'public/submission/assets');
const OUTPUT = path.join(ROOT, 'output/presentation');
const C = { paper: 'FAFAF3', ink: '1A1A1A', muted: '65685E', wash: 'EEEFE5', pale: 'C4C8B9' };
const W = 13.333333, H = 7.5;
const pres = new PptxGenJS();
pres.defineLayout({ name: 'DBC_WIDE', width: W, height: H });
pres.layout = 'DBC_WIDE';
pres.author = 'Daniyar Gabdullin';
pres.subject = 'DBC Guard product presentation';
pres.title = 'DBC Guard — Understand a Meteora launch before you trade';
pres.company = 'DBC Guard';
pres.lang = 'en-US';
pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'en-US' };

function text(slide, value, x, y, w, h, size = 22, extra = {}) {
  slide.addText(value, { x, y, w, h, fontFace: 'Arial', fontSize: size, color: C.ink, margin: 0, breakLine: false, valign: 'mid', paraSpaceAfterPt: 0, ...extra });
}
function rect(slide, x, y, w, h, color) {
  slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color }, line: { color, transparency: 100 } });
}
function page(number, label, dark = false) {
  const slide = pres.addSlide();
  slide.background = { color: dark ? C.ink : C.paper };
  text(slide, `${String(number).padStart(2, '0')} / ${label.toUpperCase()}`, .75, .43, 10.8, .25, 10, { fontFace: 'Courier New', charSpacing: 1.1, color: dark ? C.pale : C.muted });
  if (number !== 8) text(slide, 'DBC GUARD', .75, 7.02, 3.3, .2, 9, { fontFace: 'Courier New', charSpacing: 1, color: dark ? C.pale : C.muted });
  text(slide, `${String(number).padStart(2, '0')} / 09`, 11.55, 7.02, 1.03, .2, 9, { align: 'right', fontFace: 'Courier New', color: dark ? C.pale : C.muted });
  return slide;
}
function heading(slide, value, x, y, w, h, size = 43, dark = false) {
  text(slide, value, x, y, w, h, size, { bold: true, color: dark ? C.paper : C.ink, charSpacing: -.7, valign: 'top', lineSpacingMultiple: 1.0 });
}
function notes(slide, value) { slide.addNotes(value); }
function link(slide, value, url, x, y, w, h, size = 14, color = C.ink) {
  text(slide, value, x, y, w, h, size, { color, hyperlink: { url, tooltip: value } });
}

(async () => {
  await fs.mkdir(OUTPUT, { recursive: true });
  const crop = path.join(OUTPUT, 'product-report-crop.png');
  const hero = path.join(OUTPUT, 'product-hero-crop.png');
  const qr = path.join(OUTPUT, 'product-qr.png');
  const original = path.join(ASSETS, 'product-report.png');
  const metadata = await sharp(original).metadata();
  await sharp(original).extract({ left: 0, top: 0, width: metadata.width, height: Math.min(metadata.height, 820) }).toFile(crop);
  await sharp(original).extract({ left: 0, top: 0, width: metadata.width, height: Math.min(metadata.height, 1135) }).toFile(hero);
  await sharp(path.join(ASSETS, 'product-qr.svg')).resize(600, 600).png().toFile(qr);

  let s = page(1, 'DBC Guard');
  text(s, 'DBC / GUARD', .75, 1.16, 5.5, .28, 13, { fontFace: 'Courier New', charSpacing: 2 });
  heading(s, 'Understand a\nMeteora launch\nbefore you trade.', .75, 1.82, 6.45, 2.25, 43);
  text(s, 'Turn a token or pool address into a clear review of fees, token controls and liquidity.', .75, 4.35, 5.75, 1.2, 23, { valign: 'top', lineSpacingMultiple: 1.15 });
  link(s, 'Live at dbc.whoim.space', 'https://dbc.whoim.space', .75, 6.05, 5.5, .35, 15);
  rect(s, 7.45, 1.4, 5.1, 4.95, C.wash);
  s.addImage({ path: hero, x: 7.65, y: 1.6, w: 4.7, h: 4.65 });
  notes(s, 'DBC Guard helps people understand a Meteora token launch before their first trade. Give it a token or pool address, and it brings fees, token controls and liquidity arrangements into one clear review.');

  s = page(2, 'The problem');
  heading(s, 'You found the token.\nNow understand the launch.', .75, 1.15, 11.8, 1.5, 42);
  text(s, 'Before their first trade, people want answers.', .75, 2.98, 11.6, .55, 24);
  [ ['01 / CONTROL', 'Who controls\nthe token?'], ['02 / COSTS', 'What fees\napply?'], ['03 / LIQUIDITY', 'What happens\nto liquidity?'] ].forEach((row, i) => {
    const x = .75 + i * 4.0;
    rect(s, x, 4.0, 3.78, 2.12, C.wash);
    text(s, row[0], x + .24, 4.25, 3.3, .28, 11, { fontFace: 'Courier New', color: C.muted });
    text(s, row[1], x + .24, 4.88, 3.28, .95, 26, { valign: 'top' });
  });
  notes(s, 'Finding a token is only the beginning. People also want to know who controls it, which fees apply and what happens to liquidity. Those are the questions DBC Guard is built to answer.');

  s = page(3, 'The product');
  heading(s, 'One address.\nA clearer\npicture.', .75, 1.25, 4.3, 2.15, 42);
  [['01', 'Paste a token or pool address.'], ['02', 'Get eight clear checks in one report.'], ['03', 'Explore the findings that matter to you.']].forEach((row, i) => {
    text(s, row[0], .75, 3.8 + i * .78, .38, .5, 12, { fontFace: 'Courier New', color: C.muted, valign: 'top' });
    text(s, row[1], 1.22, 3.75 + i * .78, 3.55, .68, 20, { valign: 'top' });
  });
  rect(s, 5.3, 1.4, 7.28, 5.12, C.wash);
  s.addImage({ path: crop, x: 5.43, y: 1.53, w: 7.02, h: 5.02 });
  notes(s, 'This is the working product. Paste an address, open the report and explore eight checks. The findings stay close to their evidence, so people can understand what they are looking at and share the report with others.');

  s = page(4, 'The value');
  heading(s, 'Understand what shapes the launch.', .75, 1.1, 11.85, .95, 39);
  text(s, 'The important choices, brought together in a readable review.', .75, 2.25, 11.7, .65, 23);
  const values = [
    ['Token controls', 'Understand who can change the token.'],
    ['Trading fees', 'See the costs set for the launch.'],
    ['Creator allocations', 'Explore the creator’s share and release schedule.'],
    ['Liquidity commitments', 'Review the launch’s liquidity allocations.'],
    ['Launch progress', 'See where the launch stands and what comes next.']
  ];
  values.forEach((row, i) => {
    const x = i < 3 ? .75 : 7.0;
    const y = i < 3 ? 3.22 + i * 1.05 : 3.22 + (i - 3) * 1.52;
    text(s, String(i + 1).padStart(2, '0'), x, y + .06, .45, .28, 12, { fontFace: 'Courier New', color: C.muted });
    text(s, row[0], x + .62, y, 4.8, .38, 23, { bold: true });
    text(s, row[1], x + .62, y + .45, 4.8, .65, 18, { valign: 'top', color: C.muted });
  });
  notes(s, 'The review brings together token controls, trading fees, creator allocations, liquidity commitments and launch progress. People get a readable starting point for their research.');

  s = page(5, 'Why Meteora', true);
  heading(s, 'Flexible launches\ndeserve clear\nexplanations.', .75, 1.6, 7.2, 3.0, 46, true);
  text(s, 'Meteora gives creators flexibility in how they launch tokens.', 8.45, 2.05, 4.12, 1.6, 25, { color: C.paper, valign: 'top' });
  text(s, 'DBC Guard helps people understand those choices before participating.', 8.45, 4.05, 4.12, 1.6, 25, { color: C.pale, valign: 'top' });
  notes(s, 'Meteora gives creators flexibility in how they launch tokens. DBC Guard makes those choices more accessible to people exploring the Meteora ecosystem.');

  s = page(6, 'The landscape');
  heading(s, 'A focused view of the launch.', .75, 1.18, 11.85, .9, 42);
  text(s, 'PRODUCT', .98, 2.58, 3.0, .3, 11, { fontFace: 'Courier New', color: C.muted });
  text(s, 'PRIMARY FOCUS', 4.65, 2.58, 7.1, .3, 11, { fontFace: 'Courier New', color: C.muted });
  [['Rugcheck', 'Token risk'], ['DEX Screener', 'Market activity and charts'], ['Solscan', 'Blockchain records'], ['DBC Guard', 'Meteora launch settings and their implications']].forEach((row, i) => {
    const y = 3.05 + i * .75;
    if (i === 1 || i === 3) rect(s, .75, y, 11.83, .75, i === 3 ? C.ink : C.wash);
    text(s, row[0], .98, y + .14, 3.35, .42, 22, { bold: i === 3, color: i === 3 ? C.paper : C.ink });
    text(s, row[1], 4.65, y + .14, 7.55, .42, 21, { color: i === 3 ? C.paper : C.ink });
  });
  text(s, 'Add launch context to your research.', .75, 6.32, 11.8, .4, 22, { color: C.muted });
  notes(s, 'People already use tools for token risk, market charts and blockchain records. DBC Guard adds a focused view of Meteora launch settings and what those choices mean. It fits alongside existing research tools.');

  s = page(7, 'Working today');
  heading(s, 'Live. Tested.\nReady to explore.', .75, 1.2, 7.2, 1.45, 43);
  text(s, '100', .7, 3.05, 6.5, 1.45, 108, { charSpacing: -5 });
  text(s, 'Real Meteora DBC pools\nused to validate the product.', .75, 4.78, 6.7, .87, 24, { valign: 'top' });
  text(s, 'Desktop and mobile.\nNo account or wallet required.', .75, 6.0, 7.0, .7, 20, { color: C.muted, valign: 'top' });
  rect(s, 9.05, 1.15, 2.76, 5.76, C.wash);
  s.addImage({ path: path.join(ASSETS, 'product-mobile.png'), x: 9.18, y: 1.28, w: 2.5, h: 5.41 });
  notes(s, 'DBC Guard is available today on desktop and mobile without an account or connected wallet. It has been validated across 100 real Meteora DBC pools. This is product-validation evidence, not a count of customers.');

  s = page(8, 'The founder');
  heading(s, 'Daniyar\nGabdullin', .75, 1.18, 6.55, 1.6, 48);
  text(s, 'Product Builder / Blockchain & AI', .75, 3.13, 6.15, .5, 23);
  text(s, 'Building in crypto since 2019.\nPractical products for people using Solana.', .75, 3.95, 5.6, 1.1, 22, { color: C.muted, valign: 'top' });
  link(s, 'portfolio.whoim.space', 'https://portfolio.whoim.space', .75, 5.68, 5.8, .35, 16);
  link(s, 'Meet Daniyar on LinkedIn', 'https://www.linkedin.com/in/daniyar-gabdullin-11312b252/', .75, 6.23, 5.8, .35, 16);
  const credentials = [
    ['PRODUCTS', 'Creator of Seeker Vault\nand X-Booster'],
    ['EDUCATION', 'Information Security\nKazakh National Technical University'],
    ['LEADERSHIP', 'Former Technical Director, SIA Amakids\nFormer Board Member, SIA GASD']
  ];
  credentials.forEach((row, i) => {
    const y = 1.45 + i * 1.62;
    rect(s, 7.14, y, 5.43, 1.4, C.wash);
    text(s, row[0], 7.43, y + .18, 4.84, .24, 10, { fontFace: 'Courier New', color: C.muted });
    text(s, row[1], 7.43, y + .57, 4.84, .66, i === 2 ? 16 : 18, { valign: 'top' });
  });
  notes(s, 'I am Daniyar Gabdullin, a product builder working across blockchain and AI. I have been building in crypto since 2019 and created Seeker Vault and X-Booster. My background combines information-security education with technical leadership experience.');

  s = page(9, 'Try DBC Guard', true);
  heading(s, 'Know the launch.\nShare the findings.', .75, 1.22, 11.7, 1.95, 52, true);
  text(s, 'Paste a token. Review the launch. Share the report.', .75, 3.6, 9.8, .65, 24, { color: C.paper });
  rect(s, .75, 4.77, 6.7, .9, C.paper);
  link(s, 'dbc.whoim.space', 'https://dbc.whoim.space', 1.03, 4.95, 6.1, .52, 32);
  link(s, 'github.com/who1900/dbc-guard', 'https://github.com/who1900/dbc-guard', .75, 6.08, 7.7, .35, 15, C.pale);
  rect(s, 10.3, 4.51, 2.0, 2.0, C.paper);
  s.addImage({ path: qr, x: 10.3, y: 4.51, w: 2, h: 2 });
  text(s, 'TRY DBC GUARD', 10.2, 6.63, 2.2, .22, 10, { fontFace: 'Courier New', align: 'center', color: C.pale });
  notes(s, 'Try DBC Guard at dbc.whoim.space. Paste a token, review the launch and share the findings. The product is live and the project is open on GitHub.');

  const destination = path.join(OUTPUT, 'dbc-guard-pitch.pptx');
  await pres.writeFile({ fileName: destination });
  await fs.copyFile(destination, path.join(ROOT, 'public/submission/dbc-guard-pitch.pptx'));
  process.stdout.write(`${destination}\n`);
})().catch(error => { console.error(error); process.exitCode = 1; });
