import { test, expect, VUE_BUILD } from "./fixtures.js";

test("mounts with defaults and does not fetch music on load", async ({
    page,
    app
}) => {
    const media = [];
    const external = [];
    page.on("response", (r) => {
        if (/\.mp3$/.test(r.url())) {
            media.push(r.url().split("/").pop());
        }
        if (!r.url().startsWith("http://127.0.0.1:8080/")) {
            external.push(r.url());
        }
    });
    await app.goto({ clock: false });
    await expect(page).toHaveTitle("Pomodoro Timer");
    expect(await app.timer()).toBe("25:00");
    expect(await app.dots()).toEqual(["-", "-", "-", "-"]);
    await expect(page.locator("#main-container")).toHaveClass(/dark-theme/);
    await expect(page.locator("html")).not.toHaveClass(/light-theme/);
    expect(await page.$eval('meta[name="theme-color"]', (e) => e.content)).toBe(
        "#121212"
    );
    expect(
        await page.$eval("html", (e) => getComputedStyle(e).backgroundColor)
    ).toBe("rgb(18, 18, 18)");
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
    // Vue from the pinned CDN URL is the only third-party request.
    expect(external).toEqual([
        "https://unpkg.com/vue@3.5.44/dist/vue.global.prod.js"
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

test("ships a Content-Security-Policy and still mounts under it", async ({
    page,
    app
}) => {
    await app.goto({ clock: false });
    const csp = await page.$eval(
        'meta[http-equiv="Content-Security-Policy"]',
        (e) => e.content
    );
    expect(csp).toContain("script-src 'self' https://unpkg.com");
    expect(csp).toContain("object-src 'none'");
    expect(await page.evaluate(() => typeof window.Vue)).toBe("object");
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
