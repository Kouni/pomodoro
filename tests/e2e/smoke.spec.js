import { test, expect } from "./fixtures.js";

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
    // WebKit issues several range requests per file; count files, not requests.
    expect([...new Set(media)].sort()).toEqual([
        "audio_break.mp3",
        "audio_finish.mp3",
        "audio_work.mp3"
    ]);
    expect(external).toEqual([]); // everything is first-party now
    const audios = await app.audios();
    const music = audios.filter((a) => a.preload === "none");
    expect(music).toHaveLength(4);
    expect(music.every((a) => a.file === "")).toBe(true); // no src until first play
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
    expect(csp).toContain("script-src 'self';"); // no CDN, no unsafe-eval
    expect(csp).toContain("object-src 'none'");
    await expect(page.locator("#main-container")).toBeVisible();
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

test.describe("progressive web app", () => {
    test.use({ serviceWorkers: "allow" });

    test("registers a service worker and exposes a manifest", async ({
        page,
        app
    }) => {
        await app.goto({ clock: false });
        await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
            "href",
            /manifest\.webmanifest$/
        );
        const scope = await page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready;
            return registration.scope;
        });
        expect(scope).toBe("http://127.0.0.1:8080/");
        const manifest = await page.evaluate(async () => {
            const href = document.querySelector('link[rel="manifest"]').href;
            return (await fetch(href)).json();
        });
        expect(manifest.name).toBe("Pomodoro Timer");
        expect(manifest.display).toBe("standalone");
    });
});
