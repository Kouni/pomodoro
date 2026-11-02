import { test, expect } from "./fixtures.js";

const taskTexts = (page) =>
    page.$$eval(".task > span:first-of-type", (els) =>
        els.map((e) => e.textContent.trim())
    );

test("adds, normalises, prioritises, completes and removes tasks", async ({
    page,
    app
}) => {
    await app.goto();
    await app.openTodo();
    await expect(app.todoPanel).toContainText("You have no tasks to complete");

    await app.addTask("  buy   milk ");
    await app.addTask("!call mum");
    await app.addTask("   ");
    expect(await taskTexts(page)).toEqual(["Buy milk", "Call mum"]);
    await expect(
        page.locator(".task").nth(1).locator("span").first()
    ).toHaveClass(/priority/);
    await expect(app.todoPanel).not.toContainText(
        "You have no tasks to complete"
    );

    const tick = page.getByRole("button", { name: "Complete Call mum" });
    await tick.click();
    await expect(tick).toHaveAttribute("aria-pressed", "true");
    await expect(tick).toHaveClass(/tick-complete/);
    await expect(
        page.locator(".task").nth(1).locator("span").first()
    ).toHaveClass(/completed/);

    await page
        .locator(".task")
        .nth(0)
        .getByRole("button", { name: "✖" })
        .click();
    await app.tick(600);
    expect(await taskTexts(page)).toEqual(["Call mum"]);
    await expect(
        page.getByRole("button", { name: "Complete Call mum" })
    ).toHaveClass(/tick-complete/);
});

test("task tick is operable from the keyboard", async ({ page, app }) => {
    await app.goto();
    await app.openTodo();
    await app.addTask("keyboard");
    const tick = page.getByRole("button", { name: "Complete Keyboard" });
    await tick.focus();
    await page.keyboard.press("Space");
    await expect(tick).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(tick).toHaveAttribute("aria-pressed", "false");
});

test("caps the list at eight tasks with a transient message", async ({
    page,
    app
}) => {
    await app.goto();
    await app.openTodo();
    for (let i = 1; i <= 8; i++) {
        await app.addTask(`task ${i}`);
    }
    await app.addTask("one too many");
    await expect(page.locator(".task")).toHaveCount(8);
    await expect(app.textarea).toHaveValue("Can't add more tasks...");
    await expect(app.textarea).toBeDisabled();
    await app.tick(3000);
    await expect(app.textarea).toHaveValue("");
    await expect(app.textarea).toBeEnabled();
});

test("tasks and their completion survive a reload", async ({ page, app }) => {
    await app.goto();
    await app.openTodo();
    await app.addTask("persist me");
    await app.addTask("!and me");
    await page.getByRole("button", { name: "Complete And me" }).click();
    await app.textarea.fill("draft");

    await page.reload();
    await expect(page.locator(".title h1")).toHaveText("Pomodoro Timer");
    await app.openTodo();
    expect(await taskTexts(page)).toEqual(["Persist me", "And me"]);
    await expect(
        page.getByRole("button", { name: "Complete And me" })
    ).toHaveClass(/tick-complete/);
    await expect(
        page.getByRole("button", { name: "Complete Persist me" })
    ).not.toHaveClass(/tick-complete/);
    await expect(app.textarea).toHaveValue("draft");
});
