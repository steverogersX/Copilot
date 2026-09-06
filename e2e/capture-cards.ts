/**
 * Regenerates the three Negotiation Card screenshots in runthroughs/.
 *
 * Drives the real form in a real browser rather than rendering the card
 * component in isolation, so the images always show what a reviewer would
 * actually see after filling the form themselves. Keeping this as a script
 * means the run-through images are reproducible rather than hand-cropped -
 * when a rule changes, re-run it instead of retaking screenshots by hand.
 *
 * Playwright is deliberately NOT a declared dependency: it pulls browser
 * binaries and would slow `npm install` for everyone just to regenerate three
 * images. Install it only when you need to run this.
 *
 * Usage:
 *   npm i -D playwright && npx playwright install chromium   (one-time)
 *   npm run dev                                              (one terminal)
 *   npx tsx e2e/capture-cards.ts                             (another)
 *
 * Override the port if next dev picked a different one:
 *   BASE_URL=http://localhost:3000 npx tsx e2e/capture-cards.ts
 */
import { chromium, type Page } from "playwright";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const OUT_DIR = path.join(process.cwd(), "runthroughs");

// Attribute selectors throughout rather than `#id`, because the repeating-row
// fields are named like `existingEmis[0].amount` - brackets and dots need CSS
// escaping as an id, but are literal inside an attribute selector.
//
// The Select components are Base UI, not native <select>, so a value can't be
// set directly - open the trigger, then click the option by its visible label.
async function selectOption(page: Page, triggerId: string, label: string) {
  await page.locator(`button[id="${triggerId}"]`).click();
  await page.getByRole("option", { name: label, exact: false }).first().click();
}

async function setInput(page: Page, name: string, value: string) {
  await page.locator(`input[id="${name}"]`).fill(value);
}

// Yes/No toggles render as a radiogroup of two labels sharing a name.
async function setYesNo(page: Page, name: string, value: "yes" | "no") {
  await page
    .locator(`[name="${name}"][value="${value}"]`)
    .first()
    .click({ force: true });
}

async function capture(page: Page, file: string) {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  // Let fonts/layout settle so text isn't captured mid-reflow.
  await page.waitForTimeout(600);
  await dialog.screenshot({ path: path.join(OUT_DIR, file) });
  console.log(`  wrote runthroughs/${file}`);
}

async function submit(page: Page) {
  await page.getByRole("button", { name: /check eligibility/i }).click();
}

async function priya(page: Page) {
  console.log("Priya...");
  await page.goto(BASE_URL);
  await selectOption(page, "loanType", "Personal Loan");
  await setInput(page, "amountWanted", "800000");
  await setInput(page, "tenurePreferred", "60");
  await setInput(page, "age", "29");
  await selectOption(page, "incomeType", "Salaried");
  await setInput(page, "netMonthlyIncome", "110000");
  await setYesNo(page, "hasCollateral", "no");

  await page.getByRole("button", { name: /add emi/i }).click();
  await setInput(page, "existingEmis[0].amount", "14000");
  await setInput(page, "existingEmis[0].monthsRemaining", "24");

  await setInput(page, "monthlyExpenses", "28000");
  await setYesNo(page, "hadEmiBounces", "no");
  await setYesNo(page, "hasHighCostDebt", "no");
  await setInput(page, "creditScore", "780");

  await submit(page);
  await capture(page, "priya-card.png");
}

async function ravi(page: Page) {
  console.log("Ravi...");
  await page.goto(BASE_URL);
  await selectOption(page, "loanType", "Business Loan");
  await setInput(page, "amountWanted", "1500000");
  await setInput(page, "tenurePreferred", "60");
  await setInput(page, "age", "42");
  await selectOption(page, "incomeType", "Self-employed");
  await setInput(page, "incomeStabilityLow", "40000");
  await setInput(page, "incomeStabilityHigh", "80000");
  await setInput(page, "yearsInBusiness", "14");

  await setYesNo(page, "hasCollateral", "yes");
  await setInput(page, "collateralValue", "4500000");
  await setYesNo(page, "collateralAlreadyPledged", "no");

  await setInput(page, "monthlyExpenses", "25000");
  await setYesNo(page, "hadEmiBounces", "no");
  await setYesNo(page, "hasHighCostDebt", "no");
  await page.getByRole("checkbox", { name: /don't know my credit score/i }).click();

  await submit(page);
  await capture(page, "ravi-card.png");
}

async function anita(page: Page) {
  console.log("Anita...");
  await page.goto(BASE_URL);
  await selectOption(page, "loanType", "Two-Wheeler");
  await setInput(page, "amountWanted", "150000");
  await setInput(page, "tenurePreferred", "24");
  await setInput(page, "age", "35");
  await selectOption(page, "incomeType", "Daily wage");
  await setInput(page, "incomeStabilityLow", "26000");
  await setInput(page, "incomeStabilityHigh", "30000");
  await setInput(page, "yearsInBusiness", "3");
  await setYesNo(page, "hasCollateral", "no");

  await setInput(page, "monthlyExpenses", "18000");

  await setYesNo(page, "hadEmiBounces", "yes");
  await page.getByRole("button", { name: /add emi bounce/i }).click();
  await selectOption(page, "emiBounces[0].frequency", "1");
  await selectOption(page, "emiBounces[0].recency", "Within the last month");

  await setYesNo(page, "hasHighCostDebt", "yes");
  await setInput(page, "highCostDebtAmount", "35000");
  await setInput(page, "highCostDebtInterestRate", "30");

  await page.getByRole("checkbox", { name: /don't know my credit score/i }).click();

  await submit(page);
  await capture(page, "anita-card.png");
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 900, height: 1400 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  try {
    await priya(page);
    await ravi(page);
    await anita(page);
    console.log("\nAll three cards regenerated.");
  } finally {
    await browser.close();
  }
})();
