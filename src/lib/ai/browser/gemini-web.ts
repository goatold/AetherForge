import { mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 45000;

const extractLikelyJson = (text: string): string | null => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim();
  }
  return null;
};

const getProfileDir = (userId: string) =>
  path.join(process.cwd(), ".aetherforge-browser-sessions", "gemini-web", userId);

const ensureProfileDir = async (userId: string) => {
  await mkdir(getProfileDir(userId), { recursive: true });
};

const assertLoggedIn = (url: string) => {
  const lowered = url.toLowerCase();
  if (lowered.includes("login") || lowered.includes("signin") || lowered.includes("auth")) {
    throw new Error("Gemini web session is not logged in. Open gemini.google.com and complete login.");
  }
};

export async function runGeminiWebPrompt(userId: string, prompt: string): Promise<string> {
  await ensureProfileDir(userId);
  let chromium: (typeof import("playwright"))["chromium"];
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is required. Run: npx playwright install chromium");
  }

  const context = await chromium.launchPersistentContext(getProfileDir(userId), {
    headless: true,
    viewport: { width: 1440, height: 900 }
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://gemini.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT_MS
    });
    assertLoggedIn(page.url());

    const input = page.locator("div[contenteditable='true']").first();
    await input.waitFor({ timeout: DEFAULT_TIMEOUT_MS });
    await input.fill(prompt);
    await input.press("Enter");

    const assistantMessages = page.locator('[data-response-author="model"]');
    await assistantMessages.first().waitFor({ timeout: DEFAULT_TIMEOUT_MS });
    const count = await assistantMessages.count();
    const lastText = (await assistantMessages.nth(Math.max(0, count - 1)).innerText()).trim();
    const parsed = extractLikelyJson(lastText);
    if (!parsed) {
      throw new Error("Could not extract JSON from Gemini response.");
    }
    return parsed;
  } finally {
    await context.close();
  }
}
