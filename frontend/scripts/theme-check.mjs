// Verifies the light/dark theme toggle end to end in a real browser.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const username = `themecheck_${Date.now().toString(36)}`;

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const htmlClass = () => page.evaluate(() => document.documentElement.className);
const pageTokens = () =>
  page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      page: styles.getPropertyValue("--page").trim(),
      ink: styles.getPropertyValue("--ink").trim(),
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
      stored: localStorage.getItem("theme"),
      colorScheme: styles.colorScheme.trim(),
    };
  });

try {
  // 1. Toggle available on the auth screen and follows the OS preference.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const authToggle = page.getByRole("button", { name: "Change theme" });
  check("toggle is rendered on the login screen", await authToggle.count() > 0);

  let tokens = await pageTokens();
  check("light is the default when the OS prefers light", (await htmlClass()).includes("light"), tokens.page);

  await authToggle.first().click();
  const menu = page.getByRole("menuitemradio");
  check("theme menu lists three options", (await menu.count()) === 3);
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await page.waitForTimeout(150);

  let darkClass = await htmlClass();
  tokens = await pageTokens();
  check("choosing Dark applies the dark class", darkClass.includes("dark"), darkClass);
  check("dark palette tokens are active", tokens.page.toLowerCase() === "#101310", tokens.page);
  check("theme choice is persisted", tokens.stored === "dark", String(tokens.stored));
  check("browser chrome colour follows the theme", tokens.themeColor?.toLowerCase() === "#101310", String(tokens.themeColor));

  await page.reload({ waitUntil: "networkidle" });
  check("dark survives a reload without a flash of light", (await htmlClass()).includes("dark"));

  // 2. System option tracks the OS setting live.
  await page.getByRole("button", { name: "Change theme" }).first().click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(200);
  check("System follows the OS dark preference", (await htmlClass()).includes("dark"));

  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(200);
  check("System follows the OS light preference", (await htmlClass()).includes("light"));

  // 3. Toggle inside the authenticated app.
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("Display name").fill("Theme Check");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("themecheck12345");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/chat/, { timeout: 20_000 });

  const appToggle = page.getByRole("button", { name: "Change theme" });
  check("toggle is rendered inside the chat app", (await appToggle.count()) > 0);

  await appToggle.first().click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await page.getByRole("menuitemradio").first().waitFor({ state: "hidden" });
  await page.waitForTimeout(150);
  check("app switches to dark", (await htmlClass()).includes("dark"));

  const surface = await page.evaluate(() => {
    const card = document.querySelector(".bg-surface");
    return card ? getComputedStyle(card).backgroundColor : null;
  });
  check("surface card picks up the dark palette", surface === "rgb(25, 28, 23)", String(surface));

  const limeInk = await page.evaluate(() => {
    const card = document.querySelector(".bg-lime");
    return card ? getComputedStyle(card).color : null;
  });
  check("text on lime stays dark in dark mode", limeInk === "rgb(13, 13, 13)", String(limeInk));

  await appToggle.first().click();
  const lightOption = page.getByRole("menuitemradio", { name: "Light" });
  await lightOption.waitFor({ state: "visible" });
  await lightOption.click();
  await page.waitForTimeout(200);
  check("app switches back to light", (await htmlClass()).includes("light"));
} catch (error) {
  check("script completed without errors", false, String(error));
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  process.exitCode = 1;
}
