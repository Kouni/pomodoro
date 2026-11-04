// Shared fixtures: the pinned Vue build is served from node_modules so the
// suite is deterministic and works offline (the browser still enforces the
// SRI hash on those bytes); Google Fonts are stubbed; every Audio element
// is recorded; console/page errors fail the test unless allowed.
import { test as base, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
export const VUE_BUILD = readFileSync(
    require.resolve("vue/dist/vue.global.prod.js"),
    "utf8"
);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
export const CLOCK_START = new Date("2026-11-02T10:00:00Z");

const text = (s) => s.replace(/\s+/g, "");

export const test = base.extend({
    vueBody: [VUE_BUILD, { option: true }],
    allowErrors: [false, { option: true }],

    page: async ({ page, vueBody }, use) => {
        await page.route("**/unpkg.com/**", (route) =>
            route.fulfill({
                status: 200,
                body: vueBody,
                headers: {
                    "content-type": "application/javascript",
                    "access-control-allow-origin": "*"
                }
            })
        );
        // axe is injected from a same-origin URL so the page's CSP stays on.
        await page.route("**/__axe.js", (route) =>
            route.fulfill({
                status: 200,
                body: AXE_SOURCE,
                headers: { "content-type": "application/javascript" }
            })
        );
        await page.addInitScript(() => {
            window.__audios = [];
            window.__played = [];
            const Original = window.Audio;
            window.Audio = function (...args) {
                const audio = new Original(...args);
                const play = audio.play.bind(audio);
                audio.play = () => {
                    window.__played.push(audio.src.split("/").pop());
                    return play();
                };
                window.__audios.push(audio);
                return audio;
            };
        });
        await use(page);
    },

    errors: [
        async ({ page, allowErrors }, use) => {
            const errors = [];
            page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
            page.on("console", (m) => {
                if (m.type() === "error") {
                    errors.push(`console: ${m.text()}`);
                }
            });
            await use(errors);
            if (!allowErrors) {
                expect(errors, "no console or page errors").toEqual([]);
            }
        },
        { auto: true }
    ],

    app: async ({ page }, use) => {
        const settingsPanel = page.locator("#settings-container .container");
        const todoPanel = page.locator("#todo-container .container");
        const app = {
            settingsPanel,
            todoPanel,
            playButton: page.locator("#play"),
            textarea: page.getByLabel("New task"),

            async goto({ clock = true, query = "" } = {}) {
                if (clock) {
                    await page.clock.install({ time: CLOCK_START });
                }
                await page.goto(`index.html${query}`);
                await expect(page.locator(".title h1")).toHaveText(
                    "Pomodoro Timer"
                );
                if (clock) {
                    // Freeze time; tests advance it explicitly with runFor.
                    await page.clock.pauseAt(CLOCK_START.getTime() + 60_000);
                }
            },
            timer: async () =>
                text(await page.locator("#svg-container h2").innerText()),
            roundName: () => page.locator(".title h2").first().innerText(),
            dots: () =>
                page.$$eval("#rounds-container li", (els) =>
                    els.map((e) => e.className.trim() || "-")
                ),
            // fastForward fires each pending timer once at the target time,
            // which is what a throttled tab does and keeps minute-long jumps
            // cheap; the app derives the display from the wall clock anyway.
            tick: (ms) => page.clock.fastForward(ms),
            async setSlider(label, value) {
                await page.getByLabel(label).evaluate((el, v) => {
                    el.value = String(v);
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                    el.dispatchEvent(new Event("change", { bubbles: true }));
                }, value);
            },
            async openSettings() {
                await page.click("#settings");
                await expect(settingsPanel).toHaveCSS("left", "20px");
            },
            async closeSettings() {
                await page
                    .locator("#settings-container .overlay")
                    .click({ position: { x: 5, y: 5 } });
                await expect(settingsPanel).toHaveAttribute("inert", "");
            },
            async openTodo() {
                await page.click("#todo");
                await expect(todoPanel).toHaveCSS("right", "20px");
            },
            async closeTodo() {
                await page
                    .locator("#todo-container .overlay")
                    .click({ position: { x: 5, y: 5 } });
                await expect(todoPanel).toHaveAttribute("inert", "");
            },
            settingsTab: (name) => page.getByRole("tab", { name }).click(),
            async addTask(value) {
                await app.textarea.fill(value);
                await app.textarea.press("Enter");
            },
            audios: () =>
                page.evaluate(() =>
                    window.__audios.map((a) => ({
                        file: a.src.split("/").pop(),
                        preload: a.preload,
                        paused: a.paused,
                        volume: Number(a.volume.toFixed(2))
                    }))
                ),
            audio: async (file) =>
                (await app.audios()).find((a) => a.file === file),
            // Files handed to play(), in order; short cues may already have
            // ended by the time a test looks, so "was played" is the stable check.
            played: () => page.evaluate(() => window.__played)
        };
        await use(app);
    }
});

export { expect };
