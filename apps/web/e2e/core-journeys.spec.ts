import { expect, test } from "@playwright/test";

test("cinematic landing page introduces the SideQuest experience", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /life comes with side quests/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter" })).toHaveAttribute("href", "/discover");
  await expect(page.getByRole("link", { name: "Open app" }).first()).toHaveAttribute("href", "/discover");
  await expect(page.getByRole("button", { name: "Decline quest" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept quest" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /three ways to play/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start your first side quest" })).toHaveAttribute("href", "/discover");
});

test("the coming-soon page stays available for the native apps", async ({ page }) => {
  await page.goto("/coming-soon");
  await expect(page.getByRole("heading", { name: "Coming soon." })).toBeVisible();
});

test("quest radar cycles cards on decline", async ({ page }) => {
  await page.goto("/");
  const radar = page.getByRole("region", { name: "Quest radar" });
  await expect(radar.getByText("1 / 3")).toBeVisible();
  await page.getByRole("button", { name: "Decline quest" }).click();
  await expect(radar.getByText("2 / 3")).toBeVisible();
});

test("email authentication is available without hiding guest discovery", async ({ page }) => {
  await page.goto("/auth?next=/create");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Apple/i })).toHaveCount(0);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse quests as a guest" })).toHaveAttribute("href", "/discover");
});

test("guest discovery remains public and protects account actions", async ({ page }) => {
  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: /bounties near you/i })).toBeVisible();
  await expect(page.getByText("Browse freely as a guest")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to create" }).first()).toHaveAttribute("href", "/auth?next=/create");
});

test("direct quest creation preserves the requested destination for guests", async ({ page }) => {
  await page.goto("/create");

  await expect(page).toHaveURL(/\/auth\?next=%2Fcreate$/);
  await expect(page.getByRole("heading", { name: "Welcome to SideQuest" })).toBeVisible();
});

test("PWA metadata and offline worker are publicly available", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  await expect(manifest.json()).resolves.toMatchObject({
    name: "SideQuest: Everyday adventures",
    start_url: "/discover",
    display: "standalone",
  });

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(await worker.text()).toContain("sidequest");
});
