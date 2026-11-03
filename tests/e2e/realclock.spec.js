import { test, expect } from "./fixtures.js";

// Everything else runs on a fake clock. These two tests let the real
// setInterval, the progress-arc tween and the audio cues run through a
// round transition, which is where a stalled timer would show up.
test.describe.configure({ mode: "parallel" });
test.setTimeout(200_000);

const oneMinuteRounds = async (app, rounds) => {
    await app.goto({ clock: false });
    await app.openSettings();
    await app.setSlider("Work minutes", 1);
    await app.setSlider("Short break minutes", 1);
    await app.setSlider("Long break minutes", 1);
    await app.setSlider("Rounds", rounds);
};

test("real clock: work round ends on time and the break auto-starts and counts", async ({
    page,
    app
}) => {
    await oneMinuteRounds(app, 2);
    await app.closeSettings();
    const started = Date.now();
    await app.playButton.click();
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break",
        { timeout: 75_000 }
    );
    const elapsed = (Date.now() - started) / 1000;
    expect(elapsed).toBeGreaterThanOrEqual(59);
    expect(elapsed).toBeLessThanOrEqual(63);
    await expect(page.locator("#svg-container h2")).toHaveText(/00:5[0-7]/, {
        timeout: 12_000
    });
    await expect(
        page.getByRole("button", { name: "Pause timer" })
    ).toBeVisible();
    await expect(page.locator(".title h2").first()).toHaveText(
        "Focus on work",
        { timeout: 75_000 }
    );
    await expect(page.locator("#svg-container h2")).toHaveText(/00:5[0-7]/, {
        timeout: 12_000
    });
});

test("real clock: infinite mode from the checkbox takes a break after the first round", async ({
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
        { timeout: 75_000 }
    );
    await expect(page.locator("#svg-container h2")).toHaveText(/00:5[0-7]/, {
        timeout: 12_000
    });
});
