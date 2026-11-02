import { test, expect } from "./fixtures.js";

const dotRows = (page) =>
    page.$$eval(
        "#rounds-container li",
        (els) =>
            new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))
                .size
    );

test("tabs switch sections and expose aria-selected", async ({ page, app }) => {
    await app.goto();
    await app.openSettings();
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    await app.settingsTab("Audio settings");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
    await expect(page.locator("#page-container")).toHaveCSS(
        "margin-left",
        "-320px"
    );

    await app.settingsTab("More settings");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#page-container")).toHaveCSS(
        "margin-left",
        "-640px"
    );
});

test("sliders update their readouts and the idle timer", async ({
    page,
    app
}) => {
    await app.goto();
    await app.openSettings();
    await app.setSlider("Work minutes", 40);
    await app.setSlider("Short break minutes", 7);
    await app.setSlider("Long break minutes", 30);
    await app.setSlider("Rounds", 6);
    await expect(page.locator("#time-page")).toContainText("40:00");
    await expect(page.locator("#time-page")).toContainText("07:00");
    await expect(page.locator("#time-page")).toContainText("30:00");
    expect(await app.dots()).toHaveLength(6);
    expect(await app.timer()).toBe("40:00");
    await app.setSlider("Rounds", 10);
    expect(await app.dots()).toHaveLength(10);
    expect(await dotRows(page)).toBe(1);

    await page
        .locator("#time-page")
        .getByRole("button", { name: "Reset to Default" })
        .click();
    expect(await app.timer()).toBe("25:00");
    expect(await app.dots()).toHaveLength(4);
    await expect(page.getByLabel("Work minutes")).toHaveValue("25");
});

test("music toggle enables the audio controls and plays the chosen track", async ({
    page,
    app
}) => {
    await app.goto();
    await app.openSettings();
    await app.settingsTab("Audio settings");
    const controls = [
        page.getByLabel("Music volume"),
        page.getByLabel("Music timing"),
        page.getByRole("button", { name: "Nature" }),
        page.getByRole("button", { name: "Café" })
    ];
    for (const c of controls) {
        await expect(c).toBeDisabled();
    }
    await page.getByLabel("Music", { exact: true }).check();
    for (const c of controls) {
        await expect(c).toBeEnabled();
    }

    await page.getByRole("button", { name: "Rain" }).click();
    await app.tick(100);
    expect((await app.audio("audio_rain.mp3")).paused).toBe(false);
    await page.getByRole("button", { name: "Café" }).click();
    expect((await app.audio("audio_rain.mp3")).paused).toBe(true);
    expect((await app.audio("audio_cafe.mp3")).paused).toBe(false);

    await page.getByLabel("Music timing").selectOption("breaks");
    expect((await app.audio("audio_cafe.mp3")).paused).toBe(true);
});

test("dark mode toggle switches the theme and persists", async ({
    page,
    app
}) => {
    await app.goto();
    await app.openSettings();
    await app.settingsTab("More settings");
    await page.getByLabel("Dark mode").uncheck();
    await expect(page.locator("#main-container")).not.toHaveClass(/dark-theme/);
    await expect(page.locator("html")).toHaveClass(/light-theme/);
    expect(await page.$eval('meta[name="theme-color"]', (e) => e.content)).toBe(
        "#f43147"
    );

    await page.reload();
    await expect(page.locator(".title h1")).toHaveText("Pomodoro Timer");
    await expect(page.locator("#main-container")).not.toHaveClass(/dark-theme/);
    await expect(page.getByLabel("Dark mode")).not.toBeChecked();
});

test("settings survive a reload", async ({ page, app }) => {
    await app.goto();
    await app.openSettings();
    await app.setSlider("Work minutes", 50);
    await app.setSlider("Rounds", 3);
    await app.settingsTab("Audio settings");
    await app.setSlider("Notification volume", 40);
    await app.settingsTab("More settings");
    await page.getByLabel("Infinite").check();

    await page.reload();
    await expect(page.locator(".title h1")).toHaveText("Pomodoro Timer");
    expect(await app.timer()).toBe("50:00");
    await expect(page.getByLabel("Rounds")).toHaveValue("3");
    await expect(page.getByLabel("Notification volume")).toHaveValue("40");
    await expect(page.getByLabel("Infinite")).toBeChecked();
    await expect(page.locator("#rounds-container")).toBeHidden();
});
