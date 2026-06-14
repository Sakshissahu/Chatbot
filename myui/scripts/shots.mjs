// Screenshot harness for visual iteration. Drives the real app + RAGFlow API.
//   node scripts/shots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP = 'http://localhost:5173';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '.screens');
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

async function settle(page, ms = 500) {
  await page.waitForTimeout(ms);
}

async function answerFlow(page) {
  // wait for streaming to start then finish (Stop button appears then detaches)
  try {
    await page.waitForSelector('[aria-label="Stop generating"]', { timeout: 12000 });
  } catch {}
  await page.waitForSelector('[aria-label="Stop generating"]', {
    state: 'detached',
    timeout: 90000,
  });
  await settle(page, 900);
}

async function login(page, name, roleLabel) {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await settle(page, 700);
  await page.fill('#name', name);
  await page.getByRole('button', { name: new RegExp(`I.?m a.? ${roleLabel}`, 'i') }).click();
  await settle(page, 500);
}

async function run(colorScheme, tag) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme, viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // 1. Login (desktop)
  await page.goto(APP, { waitUntil: 'networkidle' });
  await settle(page, 800);
  await shot(page, `01-login-${tag}`);

  // 2. Login with selection made
  await page.fill('#name', tag === 'dark' ? 'Asha' : 'Ravi');
  const role = tag === 'dark' ? 'Farmer' : 'Employee';
  await page.getByRole('button', { name: new RegExp(`I.?m a.? ${role}`, 'i') }).click();
  await settle(page, 600);
  await shot(page, `02-login-selected-${tag}`);

  // 3. Enter chat -> empty state
  await page.getByRole('button', { name: /Enter the assistant/i }).click();
  await page.waitForSelector('text=Hello,', { timeout: 10000 });
  await settle(page, 800);
  await shot(page, `03-chat-empty-${tag}`);

  // 4. Ask the first suggestion -> streamed answer with citations
  await page.locator('button:has-text("?")').first().click().catch(async () => {
    // fallback: type a question
    await page.fill('textarea', 'What biosecurity measures are recommended for poultry sheds?');
    await page.keyboard.press('Enter');
  });
  await answerFlow(page);
  await shot(page, `04-chat-answer-${tag}`);

  // open sources if present
  const srcBtn = page.locator('button:has-text("source")').first();
  if (await srcBtn.count()) {
    await srcBtn.click();
    await settle(page, 500);
    await srcBtn.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 320);
    await settle(page, 500);
  }
  await shot(page, `05-chat-sources-${tag}`);

  // 5. Mobile login
  await page.setViewportSize(MOBILE);
  await page.goto(APP, { waitUntil: 'networkidle' });
  await settle(page, 800);
  await shot(page, `06-login-mobile-${tag}`);

  await browser.close();
}

// Employee isolation: farming question should be refused
async function isolation() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page, 'Ravi', 'Employee');
  await page.getByRole('button', { name: /Enter the assistant/i }).click();
  await page.waitForSelector('text=Hello,', { timeout: 10000 });
  await page.fill('textarea', 'What biosecurity measures are recommended for poultry sheds?');
  await page.keyboard.press('Enter');
  await answerFlow(page);
  await shot(page, '07-employee-refusal');
  await browser.close();
}

await run('dark', 'dark');
await run('light', 'light');
await isolation();
console.log('screenshots written to', OUT);
