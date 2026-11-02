import { test, expect } from "./fixtures.js";

const runAxe = async (page, options = {}) => {
    await page.addScriptTag({ url: "/__axe.js" });
    const violations = await page.evaluate(
        (opts) =>
            window.axe
                .run(document, { resultTypes: ["violations"], ...opts })
                .then((r) => r.violations),
        options
    );
    return violations.map(
        (v) =>
            `${v.impact}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`
    );
};

test("axe finds no violations in the main view, settings and todo", async ({
    page,
    app
}) => {
    await app.goto({ clock: false });
    expect(await runAxe(page)).toEqual([]);

    await app.openSettings();
    expect(await runAxe(page)).toEqual([]);
    await app.closeSettings();

    await app.openTodo();
    await app.addTask("audit me");
    expect(await runAxe(page)).toEqual([]);
});

test("axe finds no violations in light mode", async ({ page, app }) => {
    await app.goto({ clock: false });
    await app.openSettings();
    await app.settingsTab("More settings");
    await page.getByLabel("Dark mode").uncheck();
    // The Reset button's colour transitions for 200ms; let it settle, or
    // axe samples a mid-transition grey and reports a false contrast failure.
    await expect(
        page
            .locator("#add_page")
            .getByRole("button", { name: "Reset to Default" })
    ).toHaveCSS("color", "rgb(20, 20, 20)");
    expect(await runAxe(page)).toEqual([]);
    await app.closeSettings();
    expect(await runAxe(page, {})).toEqual([]);
});

test("keyboard focus never enters closed panels or scrolls the page", async ({
    page,
    app
}) => {
    await app.goto({ clock: false });
    const visited = [];
    for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        visited.push(
            await page.evaluate(() => {
                const el = document.activeElement;
                const r = el.getBoundingClientRect();
                return {
                    id: el.id || el.tagName.toLowerCase(),
                    inert: el.closest("[inert]") !== null,
                    onScreen: r.left >= 0 && r.right <= innerWidth,
                    scrollLeft: document.body.scrollLeft
                };
            })
        );
    }
    expect(visited.filter((v) => v.inert)).toEqual([]);
    expect(visited.filter((v) => !v.onScreen)).toEqual([]);
    expect(visited.filter((v) => v.scrollLeft !== 0)).toEqual([]);
    expect(visited.map((v) => v.id).slice(0, 5)).toEqual([
        "settings",
        "todo",
        "restart",
        "play",
        "button"
    ]);
});

test("settings tabs are reachable and switchable with the keyboard", async ({
    page,
    app
}) => {
    await app.goto({ clock: false });
    await app.openSettings();
    const audioTab = page.getByRole("tab", { name: "Audio settings" });
    for (
        let i = 0;
        i < 10 &&
        !(await audioTab.evaluate((el) => el === document.activeElement));
        i++
    ) {
        await page.keyboard.press("Tab");
    }
    await expect(audioTab).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(audioTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#page-container")).toHaveCSS(
        "margin-left",
        "-320px"
    );
});

test("keyboard focus is visible", async ({ page, app }) => {
    await app.goto({ clock: false });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(app.playButton).toBeFocused();
    await expect(app.playButton).toHaveCSS("outline-style", "solid");
    await expect(app.playButton).toHaveCSS("outline-width", "2px");
});

test("prefers-reduced-motion stops animations but the bar still advances", async ({
    page,
    app
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await app.goto();
    await app.playButton.click();
    await app.tick(1000);
    // Under the fake clock finished 0.01ms transitions can linger, so check
    // that nothing long-running or repeating exists rather than "none".
    const longRunning = await page.evaluate(
        () =>
            document.getAnimations().filter((a) => {
                const timing = a.effect.getTiming();
                return timing.duration > 1 || timing.iterations > 1;
            }).length
    );
    expect(longRunning).toBe(0);
    const before = await page.$eval(
        "#timer-path",
        (e) => e.style.strokeDashoffset
    );
    await app.tick(1000);
    const after = await page.$eval(
        "#timer-path",
        (e) => e.style.strokeDashoffset
    );
    expect(after).not.toBe(before);
});
