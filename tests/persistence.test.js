import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./harness.js";

const DEFAULTS = {
    roundRange: "4",
    workRange: "25",
    sBreakRange: "5",
    lBreakRange: "15",
    soundVolume: "100",
    musicVolume: "75",
    musicPref: "nature",
    isMusic: "false",
    autoPomodoro: "true",
    autoBreak: "true",
    autoTodoEmpty: "false",
    infinite: "false",
    musicTiming: "work",
    darkMode: "true",
    enableNotifications: "true",
    newTask: "",
    tasks: "[]"
};

test("first run writes every default to localStorage as strings", () => {
    const { localStorage } = createApp();
    assert.deepEqual(Object.fromEntries(localStorage.store), DEFAULTS);
});

test("stored settings are restored on boot", () => {
    const { api } = createApp({
        storage: {
            ...DEFAULTS,
            roundRange: "2",
            workRange: "50",
            sBreakRange: "3",
            lBreakRange: "20",
            soundVolume: "40",
            musicVolume: "10",
            musicPref: "cafe",
            isMusic: "true",
            autoPomodoro: "false",
            autoBreak: "false",
            autoTodoEmpty: "true",
            musicTiming: "both",
            darkMode: "false",
            enableNotifications: "false",
            newTask: "draft",
            tasks: JSON.stringify([
                { text: "A", completed: true, priority: false }
            ])
        }
    });
    assert.equal(api.roundRange.value, 2);
    assert.equal(api.totalRound.value, 4);
    assert.equal(api.workRange.value, 50);
    assert.equal(api.minutes.value, 50);
    assert.equal(api.sBreakRange.value, 3);
    assert.equal(api.lBreakRange.value, 20);
    assert.equal(api.soundVolume.value, 40);
    assert.equal(api.musicVolume.value, 10);
    assert.equal(api.musicPref.value, "cafe");
    assert.equal(api.isMusic.value, true);
    assert.equal(api.autoPomodoro.value, false);
    assert.equal(api.autoBreak.value, false);
    assert.equal(api.autoTodoEmpty.value, true);
    assert.equal(api.musicTiming.value, "both");
    assert.equal(api.darkMode.value, false);
    assert.equal(api.enableNotifications.value, false);
    assert.equal(api.newTask.value, "draft");
    assert.deepEqual(api.tasks.value, [
        { text: "A", completed: true, priority: false }
    ]);
});

test("legacy musicInBreaks is migrated to musicTiming and removed", () => {
    const seed = { ...DEFAULTS, musicInBreaks: "true" };
    delete seed.musicTiming;
    const { api, localStorage } = createApp({ storage: seed });
    assert.equal(api.musicTiming.value, "both");
    assert.equal(localStorage.getItem("musicInBreaks"), null);

    const seed2 = { ...DEFAULTS, musicInBreaks: "false" };
    delete seed2.musicTiming;
    assert.equal(createApp({ storage: seed2 }).api.musicTiming.value, "work");
});

test("missing darkMode/enableNotifications default to true", () => {
    const seed = { ...DEFAULTS };
    delete seed.darkMode;
    delete seed.enableNotifications;
    const { api } = createApp({ storage: seed });
    assert.equal(api.darkMode.value, true);
    assert.equal(api.enableNotifications.value, true);
});

test("roundRange 0 from the old infinite-mode bug is repaired to 4", () => {
    const { api } = createApp({ storage: { ...DEFAULTS, roundRange: "0" } });
    assert.equal(api.roundRange.value, 4);
    assert.equal(api.totalRound.value, 8);
});

test("infinite=true restores 999 total rounds", () => {
    const { api } = createApp({ storage: { ...DEFAULTS, infinite: "true" } });
    assert.equal(api.infinite.value, true);
    assert.equal(api.totalRound.value, 999);
});

test("corrupt tasks JSON falls back to an empty list", () => {
    const { api } = createApp({ storage: { ...DEFAULTS, tasks: "{not json" } });
    assert.deepEqual(api.tasks.value, []);
});

test("state changes are persisted through the watcher", () => {
    const { api, localStorage, flushWatchers } = createApp();
    api.roundRange.value = 7;
    api.isMusic.value = true;
    api.newTask.value = "wip";
    api.tasks.value.push({ text: "X", completed: false, priority: true });
    flushWatchers();
    assert.equal(localStorage.getItem("roundRange"), "7");
    assert.equal(localStorage.getItem("isMusic"), "true");
    assert.equal(localStorage.getItem("newTask"), "wip");
    assert.equal(
        localStorage.getItem("tasks"),
        JSON.stringify([{ text: "X", completed: false, priority: true }])
    );
});

test("the 'too many tasks' placeholder is never persisted as a draft", () => {
    const { api, localStorage, flushWatchers } = createApp();
    api.newTask.value = "Can't add more tasks...";
    flushWatchers();
    assert.equal(localStorage.getItem("newTask"), "");
});
