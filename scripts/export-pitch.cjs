const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, ...(process.env.PITCH_BROWSER ? { executablePath: process.env.PITCH_BROWSER } : { channel: 'chrome' }) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    await page.goto(pathToFileURL(path.join(root, 'public/submission/pitch.html')).href);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    await page.emulateMedia({ media: 'print' });
    const destination = path.join(root, 'output/pdf/dbc-guard-pitch.pdf');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await page.pdf({ path: destination, printBackground: true, preferCSSPageSize: true });
    await fs.copyFile(destination, path.join(root, 'public/submission/dbc-guard-pitch.pdf'));
    process.stdout.write(`${destination}\n`);
  } finally {
    await browser.close();
  }
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
