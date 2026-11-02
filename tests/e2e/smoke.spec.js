import { test, expect, VUE_BUILD } from "./fixtures.js";

test("mounts with defaults and does not fetch music on load", async ({
    page,
    app
}) => {
    const media = [];
    page.on("response", (r) => {
        if (/\.mp3$/.test(r.url())) {
            media.push(r.url().split("/").pop());
        }
    });
    await app.goto({ clock: false });
    await expect(page).toHaveTitle("Pomodoro Timer");
    expect(await app.timer()).toBe("25:00");
    expect(await app.dots()).toEqual(["-", "-", "-", "-"]);
    await expect(page.locator("#main-container")).toHaveClass(/dark-theme/);
    await expect(page.locator("#main-container")).not.toHaveAttribute(
        "v-cloak",
        ""
    );
    await page.waitForLoadState("networkidle");
    expect(media.sort()).toEqual([
        "audio_break.mp3",
        "audio_finish.mp3",
        "audio_work.mp3"
    ]);
    const audios = await app.audios();
    expect(
        audios
            .filter((a) => a.preload === "none")
            .map((a) => a.file)
            .sort()
    ).toEqual([
        "audio_cafe.mp3",
        "audio_music.mp3",
        "audio_nature.mp3",
        "audio_rain.mp3"
    ]);
});

test("loads the pinned Vue build through Subresource Integrity", async ({
    page,
    app
}) => {
    await app.goto({ clock: false });
    expect(await page.evaluate(() => window.Vue.version)).toBe("3.5.44");
});

test.describe("tampered CDN response", () => {
    test.use({ vueBody: `${VUE_BUILD}\n/* tampered */`, allowErrors: true });

    test("is rejected by the browser and the app does not mount", async ({
        page,
        errors
    }) => {
        await page.goto("index.html");
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => typeof window.Vue)).toBe("undefined");
        expect(errors.some((e) => /integrity/i.test(e))).toBe(true);
        await expect(page.locator("#main-container")).toHaveAttribute(
            "v-cloak",
            ""
        );
    });
});

test("exposes landmarks and named controls", async ({ page, app }) => {
    await app.goto({ clock: false });
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
        page.getByRole("complementary", { name: "Settings" })
    ).toBeAttached();
    await expect(
        page.getByRole("complementary", { name: "To-do list" })
    ).toBeAttached();
    await expect(
        page.getByRole("button", { name: "Start timer" })
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Restart Icon" })
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Fast Forward Icon" })
    ).toBeVisible();
});
