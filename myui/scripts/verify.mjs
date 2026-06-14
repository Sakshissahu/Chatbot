// End-to-end verification against the live RAGFlow API + navigation/sidebar.
// Captures proof screenshots into .screens/verify-*.png.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5175';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.screens');
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, `verify-${name}.png`) });
  console.log('  •', `verify-${name}.png`);
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('  [console.error]', m.text()));

  // Login → role → chat
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('#username', 'Asha');
  await page.fill('#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Choose your assistant');
  await page.click('button[data-role="farmer"]');
  await page.waitForSelector('textarea');
  console.log('flow: login → role → chat ✓');

  // Send a real question
  await page.click('text=What biosecurity measures');
  console.log('sent question, awaiting streamed answer…');
  try {
    await page.waitForSelector('text=from the knowledge base', { timeout: 90000 });
    console.log('streamed answer + citations ✓');
  } catch {
    console.log('⚠ no citation disclosure detected within 90s (answer may be a refusal)');
  }
  await page.waitForTimeout(800);
  await shot(page, '1-answer');

  // Expand sources
  const srcBtn = page.locator('text=from the knowledge base').first();
  if (await srcBtn.count()) {
    await srcBtn.click();
    await page.waitForTimeout(500);
    await shot(page, '2-sources');
  }

  // New chat → should reset to empty + add a sidebar entry
  await page.click('button:has-text("New chat")');
  await page.waitForTimeout(500);
  await shot(page, '3-newchat');

  // Switch back to the first (titled) chat
  await page.click('text=What biosecurity measures');
  await page.waitForTimeout(500);
  await shot(page, '4-switched');

  // Collapse sidebar (hamburger)
  await page.click('button[aria-label="Toggle sidebar"]');
  await page.waitForTimeout(500);
  await shot(page, '5-collapsed');

  // Logo = Home → role select
  await page.click('button[aria-label="Home"]');
  await page.waitForSelector('text=Choose your assistant');
  console.log('logo=home → role select ✓');
  await shot(page, '6-home');

  await browser.close();
  console.log('done →', OUT);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
