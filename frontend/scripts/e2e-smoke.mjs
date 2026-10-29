import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = "correct-horse-42";
const suffix = Date.now().toString(36).slice(-6);

const alice = { name: `Alice ${suffix}`, username: `alice_${suffix}` };
const bob = { name: `Bob ${suffix}`, username: `bob_${suffix}` };

async function waitEnabled(locator, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await locator.isEnabled()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Element stayed disabled");
}

async function register(page, user) {
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Display name").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/chat`);
  await page.getByText("Chats", { exact: true }).waitFor();
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pageA = await contextA.newPage();
const pageB = await contextB.newPage();

const browserErrors = [];
for (const page of [pageA, pageB]) {
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });
}

try {
  console.log("1. Registering two users…");
  await register(pageA, alice);
  await register(pageB, bob);

  console.log("2. Checking desktop shell and palette…");
  assert.equal(await pageA.locator("aside").isVisible(), true);
  assert.equal(await pageA.getByText("Pick up a conversation").isVisible(), true);
  const pageBackground = await pageA.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  assert.equal(pageBackground, "rgb(185, 191, 178)");
  const limeBackground = await pageA.evaluate(() => {
    const element = document.querySelector(".bg-lime");
    return element ? getComputedStyle(element).backgroundColor : null;
  });
  assert.equal(limeBackground, "rgb(199, 240, 50)");

  console.log("3. Alice starts a 1:1 chat with Bob…");
  await pageA.getByRole("button", { name: "Start a new conversation" }).click();
  const dialogA = pageA.getByRole("dialog");
  await dialogA.getByPlaceholder("Search people").fill(bob.name);
  await dialogA.getByRole("button", { name: new RegExp(bob.name) }).click();
  await pageA.waitForURL(/\/chat\/[0-9a-f]{24}$/);
  await pageA.getByRole("textbox", { name: "Message", exact: true }).waitFor();

  console.log("4. Alice sends a real-time message…");
  await waitEnabled(pageA.getByRole("textbox", { name: "Message", exact: true }));
  await pageA.getByRole("textbox", { name: "Message", exact: true }).fill("Hi Bob");
  await waitEnabled(pageA.getByRole("button", { name: "Send message" }));
  await pageA.getByRole("button", { name: "Send message" }).click();
  await pageA.getByText("Hi Bob", { exact: true }).waitFor();

  console.log("5. Bob receives it and replies…");
  await pageB.reload();
  await pageB.getByRole("link", { name: new RegExp(alice.name) }).click();
  await pageB.getByText("Hi Bob", { exact: true }).waitFor();
  await waitEnabled(pageB.getByRole("textbox", { name: "Message", exact: true }));
  await pageB.getByRole("textbox", { name: "Message", exact: true }).fill("Hey Alice");
  await pageB.getByRole("button", { name: "Send message" }).click();
  await pageA.getByText("Hey Alice", { exact: true }).waitFor();

  console.log("6. Alice creates a group with Bob…");
  await pageA.getByRole("button", { name: "New group" }).click();
  const groupDialog = pageA.getByRole("dialog");
  await groupDialog.getByPlaceholder("Group name").fill("Design team");
  await groupDialog.getByPlaceholder("Search people").fill(bob.name);
  await groupDialog.getByRole("button", { name: new RegExp(bob.name) }).click();
  await groupDialog.getByRole("button", { name: "Create group" }).click();
  await pageA.getByRole("heading", { name: "Design team" }).waitFor();
  await pageA.getByRole("textbox", { name: "Message", exact: true }).fill("Welcome to the group");
  await waitEnabled(pageA.getByRole("button", { name: "Send message" }));
  await pageA.getByRole("button", { name: "Send message" }).click();
  await pageA.getByText("Welcome to the group", { exact: true }).waitFor();

  console.log("7. Checking the mobile layout…");
  await pageA.setViewportSize({ width: 390, height: 844 });
  await pageA.goto(`${BASE}/chat`);
  await pageA.getByText("Chats", { exact: true }).waitFor();
  assert.equal(await pageA.getByRole("link", { name: "Back to chats" }).count(), 0);
  assert.equal(await pageA.getByText("Pick up a conversation").isVisible(), false);
  await pageA.getByRole("link", { name: /Design team/ }).click();
  await pageA.getByRole("link", { name: "Back to chats" }).waitFor();
  assert.equal(await pageA.getByRole("heading", { name: "Design team" }).isVisible(), true);
  assert.equal(await pageA.getByText("Chats", { exact: true }).isVisible(), false);
  await pageA.getByRole("link", { name: "Back to chats" }).click();
  await pageA.waitForURL(`${BASE}/chat`);

  console.log("8. Verifying PWA manifest and service worker…");
  const manifestResponse = await pageA.request.get(`${BASE}/manifest.webmanifest`);
  assert.equal(manifestResponse.status(), 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/chat");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  const serviceWorker = await pageA.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return null;
    }
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    if (!registration) {
      return null;
    }
    return { scope: registration.scope, active: Boolean(registration.active) };
  });
  assert.ok(serviceWorker, "service worker did not become ready");
  assert.equal(serviceWorker.active, true);
  assert.equal(new URL(serviceWorker.scope).pathname, "/");

  console.log("9. Checking the PWA shortcut and offline fallback…");
  await pageA.goto(`${BASE}/chat?new=group`);
  await pageA.getByRole("dialog").waitFor();
  await pageA.keyboard.press("Escape");
  await pageA.context().setOffline(true);
  await pageA.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded" });
  await pageA.getByText("Chats", { exact: true }).waitFor();
  await pageA.goto(`${BASE}/offline-smoke-check`, { waitUntil: "domcontentloaded" });
  await pageA.getByText("You're offline", { exact: false }).waitFor();
  await pageA.context().setOffline(false);
  await pageA.goto(`${BASE}/chat`);
  await pageA.getByText("Chats", { exact: true }).waitFor();

  console.log("10. Checking group delivery to Bob's socket…");
  await pageB.reload();
  await pageB.getByRole("link", { name: /Design team/ }).waitFor();
  await pageB.getByRole("link", { name: /Design team/ }).click();
  await pageB.getByText("Welcome to the group", { exact: true }).waitFor();

  const unexpectedErrors = browserErrors.filter(
    (message) =>
      !message.includes("ERR_INTERNET_DISCONNECTED") &&
      !message.includes("WebSocket connection") &&
      !message.includes("Failed to fetch RSC payload"),
  );
  assert.deepEqual(unexpectedErrors, []);
  console.log("\nE2E smoke passed.");
} catch (error) {
  console.error("\nE2E smoke failed:", error);
  console.error("Browser errors:", browserErrors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
