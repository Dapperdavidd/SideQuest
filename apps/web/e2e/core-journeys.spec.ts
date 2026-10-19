import { expect, test } from "@playwright/test";

test("landing page presents SideQuest as a limited-entry social challenge app", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /life comes with side quests/i })).toBeVisible();
  await expect(page.getByText("10 max")).toBeVisible();
  await expect(page.getByText("3 max")).toBeVisible();
  await expect(page.getByRole("link", { name: "Find a quest" })).toHaveAttribute("href", "/discover");
});

test("email authentication is available without hiding guest discovery", async ({ page }) => {
  await page.goto("/auth?next=/create");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse quests as a guest" })).toHaveAttribute("href", "/discover");
});

test("guest discovery remains public and protects account actions", async ({ page }) => {
  await page.goto("/discover");

  await expect(page.getByRole("heading", { name: "What will you do today?" })).toBeVisible();
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
    name: "SideQuest — Everyday adventures",
    start_url: "/discover",
    display: "standalone",
  });

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(await worker.text()).toContain("sidequest");
});
