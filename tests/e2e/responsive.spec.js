import { test, expect } from "./fixtures.js";

for (const viewport of [
    { width: 375, height: 667 },
    { width: 320, height: 568 },
    { width: 1024, height: 480 }
]) {
    test(`fits ${viewport.width}x${viewport.height} without overflow`, async ({
        page,
        app
    }) => {
        await page.setViewportSize(viewport);
        await app.goto({ clock: false });
        const metrics = () =>
            page.evaluate(() => {
                const d = document.documentElement;
                const inView = (sel) => {
                    const r = document
                        .querySelector(sel)
                        .getBoundingClientRect();
                    return (
                        r.top >= 0 &&
                        r.bottom <= innerHeight &&
                        r.left >= 0 &&
                        r.right <= innerWidth
                    );
                };
                return {
                    overflowX: d.scrollWidth > d.clientWidth,
                    overflowY: d.scrollHeight > d.clientHeight,
                    timer: inView("#svg-container"),
                    buttons: inView("#button-container")
                };
            });
        expect(await metrics()).toEqual({
            overflowX: false,
            overflowY: false,
            timer: true,
            buttons: true
        });

        await app.openSettings();
        await app.setSlider("Rounds", 10);
        expect(
            await page.$$eval(
                "#rounds-container li",
                (els) =>
                    new Set(
                        els.map((e) =>
                            Math.round(e.getBoundingClientRect().top)
                        )
                    ).size
            )
        ).toBe(1);
        const settings = await app.settingsPanel.boundingBox();
        expect(settings.x).toBeGreaterThanOrEqual(0);
        if (viewport.width >= 340) {
            // The settings panel is a fixed 320px with a 20px inset, so it is
            // clipped on narrower screens (HEALTH_CHECK.md U10).
            expect(settings.x + settings.width).toBeLessThanOrEqual(
                viewport.width
            );
        }
        await app.closeSettings();

        await app.openTodo();
        const todo = await app.todoPanel.boundingBox();
        expect(todo.x).toBeGreaterThanOrEqual(0);
        expect(todo.x + todo.width).toBeLessThanOrEqual(viewport.width);
    });
}
