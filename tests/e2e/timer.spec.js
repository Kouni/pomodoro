import { test, expect } from "./fixtures.js";

// One-minute rounds, two rounds: work -> short -> work -> long -> finished.
const shortSession = async (app, { rounds = 2 } = {}) => {
    await app.goto();
    await app.openSettings();
    await app.setSlider("Work minutes", 1);
    await app.setSlider("Short break minutes", 1);
    await app.setSlider("Long break minutes", 2);
    await app.setSlider("Rounds", rounds);
    await app.closeSettings();
};

test("play starts a work round and counts down from the wall clock", async ({
    page,
    app
}) => {
    await app.goto();
    const offsetBefore = await page.$eval(
        "#timer-path",
        (e) => e.style.strokeDashoffset
    );
    await app.playButton.click();
    await expect(page.locator(".title h2").first()).toHaveText("Focus on work");
    await expect(page).toHaveTitle("🔥 25:00 - Pomodoro Timer");
    expect(await app.dots()).toEqual(["process", "-", "-", "-"]);
    await expect(
        page.getByRole("button", { name: "Pause timer" })
    ).toBeVisible();

    await app.tick(1000);
    expect(await app.timer()).toBe("24:59");
    await expect(page).toHaveTitle("🔥 24:59 - Pomodoro Timer");
    const offsetAfter = await page.$eval(
        "#timer-path",
        (e) => e.style.strokeDashoffset
    );
    expect(offsetAfter).not.toBe(offsetBefore);

    await app.tick(59_000);
    expect(await app.timer()).toBe("24:00");
});

test("walks work, short break, work, long break and finishes", async ({
    page,
    app
}) => {
    await shortSession(app);
    expect(await app.timer()).toBe("01:00");
    expect(await app.dots()).toEqual(["-", "-"]);
    await app.playButton.click();
    await expect(page.locator(".title h2").first()).toHaveText("Focus on work");

    await app.tick(60_000);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break"
    );
    expect(await app.timer()).toBe("01:00");
    await expect(page).toHaveTitle("😴 01:00 - Pomodoro Timer");
    expect(await app.dots()).toEqual(["active", "-"]);
    expect((await app.audio("audio_break.mp3")).paused).toBe(false);

    await app.tick(60_000);
    await expect(page.locator(".title h2").first()).toHaveText("Focus on work");
    expect(await app.dots()).toEqual(["active", "process"]);

    await app.tick(60_000);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a long break"
    );
    expect(await app.timer()).toBe("02:00");
    expect(await app.dots()).toEqual(["active", "active"]);

    await app.tick(120_000);
    await expect(page.locator(".title h1")).toBeVisible();
    expect(await app.timer()).toBe("00:00");
    await expect(page).toHaveTitle("Pomodoro Timer");
    await expect(
        page.getByRole("button", { name: "Start timer" })
    ).toBeVisible();
    expect((await app.audio("audio_finish.mp3")).paused).toBe(false);

    await app.playButton.click();
    await expect(page.locator(".title h2").first()).toHaveText("Focus on work");
    expect(await app.dots()).toEqual(["process", "-"]);
});

test("pause freezes the clock, resume continues, reset returns to idle", async ({
    page,
    app
}) => {
    await shortSession(app);
    await app.playButton.click();
    await app.tick(5000);
    expect(await app.timer()).toBe("00:55");

    await app.playButton.click();
    await expect(page).toHaveTitle("🔥 ⏸️ Paused - Pomodoro Timer");
    await app.tick(10_000);
    expect(await app.timer()).toBe("00:55");

    await app.playButton.click();
    await app.tick(1000);
    expect(await app.timer()).toBe("00:54");
    await expect(page).toHaveTitle("🔥 00:54 - Pomodoro Timer");

    await page.click("#restart");
    expect(await app.timer()).toBe("01:00");
    await expect(page).toHaveTitle("Pomodoro Timer");
    await expect(page.locator(".title h1")).toBeVisible();
    expect(await app.dots()).toEqual(["-", "-"]);
    await app.tick(5000);
    expect(await app.timer()).toBe("01:00");
});

test("fast forward skips to the next round", async ({ page, app }) => {
    await shortSession(app);
    await app.playButton.click();
    await page.getByRole("button", { name: "Fast Forward Icon" }).click();
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break"
    );
    expect(await app.dots()).toEqual(["active", "-"]);
    await app.tick(1000);
    expect(await app.timer()).toBe("00:59");
});

test("with auto-start breaks off the break waits for play", async ({
    page,
    app
}) => {
    await shortSession(app);
    await app.openSettings();
    await app.settingsTab("More settings");
    await page.getByLabel("Auto-start breaks").uncheck();
    await app.closeSettings();

    await app.playButton.click();
    await app.tick(60_000);
    await expect(page.locator(".title h2").first()).toHaveText(
        "Take a short break"
    );
    await expect(
        page.getByRole("button", { name: "Start timer" })
    ).toBeVisible();
    await app.tick(5000);
    expect(await app.timer()).toBe("01:00");

    await app.playButton.click();
    await app.tick(1000);
    expect(await app.timer()).toBe("00:59");
});

test("infinite mode toggled from the checkbox keeps alternating work and breaks", async ({
    page,
    app
}) => {
    await shortSession(app, { rounds: 1 });
    await app.openSettings();
    await app.settingsTab("More settings");
    await page.getByLabel("Infinite").check();
    await app.closeSettings();
    await expect(page.locator("#rounds-container")).toBeHidden();

    await app.playButton.click();
    for (let i = 0; i < 3; i++) {
        await app.tick(60_000);
        await expect(page.locator(".title h2").first()).toHaveText(
            "Take a short break"
        );
        await app.tick(60_000);
        await expect(page.locator(".title h2").first()).toHaveText(
            "Focus on work"
        );
    }
    await expect(
        page.getByRole("button", { name: "Pause timer" })
    ).toBeVisible();
});
