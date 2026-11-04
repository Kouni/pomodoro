import { test, expect } from "./fixtures.js";

// Everything else runs on a fake clock. These tests let the real
// setInterval, the progress-arc tween and the audio cues run through round
// transitions, which is where a stalled timer would show up. The local
// ?minute=3 scale makes a one-minute round last 3 s (see MINUTE in index.js).
const MINUTE_MS = 3000;
const query = "?minute=3";

const oneMinuteRounds = async (app, rounds) => {
    await app.goto({ clock: false, query });
    await app.openSettings();
    await app.setSlider("Work minutes", 1);
    await app.setSlider("Short break minutes", 1);
    await app.setSlider("Long break minutes", 1);
    await app.setSlider("Rounds", rounds);
};

const expectCounting = async (app) => {
    const before = await app.timer();
    await expect.poll(() => app.timer(), { timeout: 2500 }).not.toBe(before);
};

test("real clock: rounds end on time and the break auto-starts and counts", async ({
    page,
    app
}) => {
    await oneMinuteRounds(app, 2);
    await app.closeSettings();
    const started = Date.now();
    await app.playButton.click();
    await expectCounting(app);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break",
        { timeout: 10_000 }
    );
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(MINUTE_MS - 500);
    expect(elapsed).toBeLessThanOrEqual(MINUTE_MS + 2500);
    await expect(
        page.getByRole("button", { name: "Pause timer" })
    ).toBeVisible();
    await expectCounting(app);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Focus on work",
        { timeout: 10_000 }
    );
    await expectCounting(app);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a long break",
        { timeout: 10_000 }
    );
    await expect(page.locator(".title h1")).toBeVisible({ timeout: 10_000 });
    await expect(
        page.getByRole("button", { name: "Start timer" })
    ).toBeVisible();
});

test("real clock: infinite mode from the checkbox keeps taking breaks", async ({
    page,
    app
}) => {
    await oneMinuteRounds(app, 1);
    await app.settingsTab("More settings");
    await page.getByLabel("Infinite").check();
    await app.closeSettings();
    await app.playButton.click();
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break",
        { timeout: 10_000 }
    );
    await expectCounting(app);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Focus on work",
        { timeout: 10_000 }
    );
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break",
        { timeout: 10_000 }
    );
});

test("real clock: pause and resume survive a transition", async ({
    page,
    app
}) => {
    await oneMinuteRounds(app, 2);
    await app.closeSettings();
    await app.playButton.click();
    await page.waitForTimeout(1200);
    await app.playButton.click(); // pause
    await expect(page).toHaveTitle(/Paused/);
    const frozen = await app.timer();
    await page.waitForTimeout(1500);
    expect(await app.timer()).toBe(frozen);
    await app.playButton.click(); // resume
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break",
        { timeout: 10_000 }
    );
    await expectCounting(app);
});
