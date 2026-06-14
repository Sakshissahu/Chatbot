// Screenshot harness for design iteration.
// Usage: node scripts/shoot.mjs            (captures the full matrix)
//        node scripts/shoot.mjs dark mobile (single theme+device)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5175';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.screens');
mkdirSync(OUT, { recursive: true });

const DEVICES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const argTheme = process.argv[2];
const argDevice = process.argv[3];
const themes = argTheme ? [argTheme] : ['dark', 'light'];
const devices = argDevice ? [argDevice] : ['desktop', 'mobile'];

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('  •', `${name}.png`);
};

const run = async () => {
  const browser = await chromium.launch();
  for (const theme of themes) {
    for (const device of devices) {
      const tag = `${theme}-${device}`;
      console.log(tag);
      const context = await browser.newContext({
        viewport: DEVICES[device],
        colorScheme: theme, // drives prefers-color-scheme → initial theme
      });
      const page = await context.newPage();

      // 1. Login
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForSelector('#username');
      await shot(page, `${tag}-1-login`);

      // 2. Role select
      await page.fill('#username', 'Asha');
      await page.fill('#password', 'demo1234');
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Choose your assistant');
      await page.waitForTimeout(600);
      await shot(page, `${tag}-2-role`);

      // 3. Chat (Farmer)
      await page.click('button[data-role="farmer"]');
      await page.waitForSelector('textarea');
      await page.waitForTimeout(700);
      await shot(page, `${tag}-3-chat`);

      // Mobile: open the drawer too
      if (device === 'mobile') {
        await page.click('button[aria-label="Toggle sidebar"]');
        await page.waitForTimeout(450);
        await shot(page, `${tag}-4-drawer`);
      }

      await context.close();
    }
  }
  await browser.close();
  console.log('done →', OUT);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
