const { test, expect } = require('@playwright/test');

async function loginAsAdmin(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.selectOption('select', 'admin');
      await page.click('button[type="submit"]');
      await page.waitForURL('/', { timeout: 10000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('ResolverAI Buildathon Smoke Suite', () => {

  test('TEST 1 — Login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('h1').first()).toContainText(/Resolver/i);
  });

  test('TEST 2 — Dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText('SYSTEM RESILIENCE', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('TOTAL PAYMENT INTENTS', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Failed to fetch');
  });

  test('TEST 3 — AI Test Lab', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/engineering/ai-test-lab', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('RESOLVERAI TEST LAB', { exact: false })).toBeVisible({ timeout: 10000 });

    const runBtn = page.getByRole('button', { name: /RUN BUILDATHON DEMO/i });
    await expect(runBtn).toBeVisible({ timeout: 10000 });
    await runBtn.click();

    // Poll until run status moves from RUNNING to terminal state (COMPLETED, FAILED, TIMED OUT, STOPPED)
    const terminalState = page.getByText(/COMPLETED|FAILED|TIMED OUT|STOPPED/i).first();
    await expect(terminalState).toBeVisible({ timeout: 45000 });

    const text = await terminalState.innerText();
    expect(text.toUpperCase()).toMatch(/COMPLETED|FAILED|TIMED OUT|STOPPED/);
  });

  test('TEST 4 — Chaos Lab', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/engineering/testing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Chaos', { exact: false }).first()).toBeVisible({ timeout: 10000 });

    const injectBtn = page.getByRole('button', { name: /Inject Delayed Webhook/i });
    await expect(injectBtn).toBeVisible({ timeout: 10000 });
    await injectBtn.click();

    const resultPanel = page.locator('pre');
    await expect(resultPanel).toBeVisible({ timeout: 20000 });
    const resultText = await resultPanel.innerText();
    expect(resultText).toContain('payment_intent_id');
  });

  test('TEST 5 — Payment Explainability', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/engineering/testing', { waitUntil: 'domcontentloaded' });
    const injectBtn = page.getByRole('button', { name: /Inject Delayed Webhook/i });
    await expect(injectBtn).toBeVisible({ timeout: 10000 });
    await injectBtn.click();

    const inspectBtn = page.locator('a', { hasText: /Inspect Intent/i }).first();
    await expect(inspectBtn).toBeVisible({ timeout: 20000 });
    await Promise.all([
      page.waitForURL(/\/payments\//, { timeout: 15000 }),
      inspectBtn.click(),
    ]);

    await expect(page.locator('body')).toContainText('1. EVENT', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('2. OBSERVATION', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('3. AI HYPOTHESIS', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('4. POLICY DECISION', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('5. TRANSITION', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('6. AUDIT EVIDENCE', { timeout: 15000 });
  });

  test('TEST 6 — Dashboard synchronization', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Failed to fetch');
    await expect(page.getByText('SYSTEM RESILIENCE', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  test('TEST 7 — Safety', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/engineering/ai-test-lab', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('NO REAL MONEY', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('ISOLATED ENVIRONMENT', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

});
