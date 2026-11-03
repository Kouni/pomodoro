import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./harness.js";

test("changeRound derives totalRound and leaves infinite mode", () => {
    const { api } = createApp();
    api.infinite.value = true;
    api.roundRange.value = 6;
    api.changeRound();
    assert.equal(api.totalRound.value, 12);
    assert.equal(api.infinite.value, false);
});

test("changeInfinite toggles between 999 rounds and roundRange*2", () => {
    const { api } = createApp();
    api.infinite.value = true;
    api.changeInfinite();
    assert.equal(api.totalRound.value, 999);
    assert.equal(api.currentRound.value, 1);

    api.infinite.value = false;
    api.roundRange.value = 0; // legacy bug state
    api.changeInfinite();
    assert.equal(api.roundRange.value, 4);
    assert.equal(api.totalRound.value, 8);
});

test("changeCountdown only follows workRange while idle", (t) => {
    t.mock.timers.enable({ apis: ["setInterval", "Date"] });
    const { api, pressPlay } = createApp();
    api.workRange.value = 30;
    api.changeCountdown();
    assert.equal(api.minutes.value, 30);
    pressPlay();
    api.workRange.value = 45;
    api.changeCountdown();
    assert.equal(api.minutes.value, 30);
});

test("resetDefault restores each settings group", () => {
    const { api } = createApp();
    Object.assign(api.roundRange, { value: 9 });
    api.workRange.value = 50;
    api.sBreakRange.value = 9;
    api.lBreakRange.value = 40;
    api.resetDefault("time");
    assert.deepEqual(
        [
            api.roundRange.value,
            api.workRange.value,
            api.sBreakRange.value,
            api.lBreakRange.value,
            api.minutes.value,
            api.totalRound.value
        ],
        [4, 25, 5, 15, 25, 8]
    );

    api.isMusic.value = true;
    api.soundVolume.value = 10;
    api.musicVolume.value = 10;
    api.musicTiming.value = "both";
    api.musicPref.value = "cafe";
    api.resetDefault("audio");
    assert.deepEqual(
        [
            api.isMusic.value,
            api.soundVolume.value,
            api.musicVolume.value,
            api.musicTiming.value,
            api.musicPref.value
        ],
        [false, 100, 75, "work", "nature"]
    );

    api.autoPomodoro.value = false;
    api.autoBreak.value = false;
    api.autoTodoEmpty.value = true;
    api.infinite.value = true;
    api.darkMode.value = false;
    api.enableNotifications.value = false;
    api.resetDefault("add");
    assert.deepEqual(
        [
            api.autoPomodoro.value,
            api.autoBreak.value,
            api.autoTodoEmpty.value,
            api.infinite.value,
            api.darkMode.value,
            api.enableNotifications.value
        ],
        [true, true, false, false, true, true]
    );
});

test("notification toggle turns itself off when permission is refused", async () => {
    const { api } = createApp();
    api.enableNotifications.value = true;
    await api.handleNotificationToggle();
    assert.equal(api.enableNotifications.value, false);
    assert.equal(api.notificationPermission.value, "denied");
});

test("notification toggle stays on when permission is granted", async () => {
    const { api } = createApp({
        notification: { requestPermission: async () => "granted" }
    });
    api.enableNotifications.value = true;
    await api.handleNotificationToggle();
    assert.equal(api.enableNotifications.value, true);
    assert.equal(api.notificationPermission.value, "granted");
});

test("app mounts without the Notification API and treats it as denied", async () => {
    // iOS Safari outside a Home-Screen PWA has no Notification global.
    const { api } = createApp({ notification: null });
    assert.equal(api.notificationPermission.value, "denied");
    api.enableNotifications.value = true;
    await api.handleNotificationToggle();
    assert.equal(api.enableNotifications.value, false);
});

test("audio: cues load eagerly, music tracks get their src on first play", () => {
    const { api, audios } = createApp();
    assert.equal(audios.instances.length, 7);
    const music = audios.instances.filter((a) => a.preload === "none");
    assert.deepEqual(music.map((a) => a.dataset.src).sort(), [
        "assets/audio_cafe.mp3",
        "assets/audio_music.mp3",
        "assets/audio_nature.mp3",
        "assets/audio_rain.mp3"
    ]);
    assert.ok(music.every((a) => a.src === undefined));
    const effects = audios.instances.filter((a) => !music.includes(a));
    assert.ok(effects.every((a) => a.preload === "auto" && a.src));

    api.isMusic.value = true;
    api.musicOn("rain");
    assert.deepEqual(audios.played, ["assets/audio_rain.mp3"]);
    assert.equal(music.filter((a) => a.src).length, 1);
});

test("music toggle respects timing: work-only music stops during a break", (t) => {
    t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
    const { api, audios, pressPlay } = createApp();
    api.isMusic.value = true;
    api.musicTiming.value = "work";
    pressPlay();
    api.musicOn("rain");
    assert.equal(api.musicPref.value, "rain");
    const rain = audios.instances.find(
        (a) => a.dataset.src === "assets/audio_rain.mp3"
    );
    assert.equal(rain.paused, false);

    api.fastForwardTimer(); // into short break
    assert.equal(rain.paused, true);
});

test("music set to breaks-only does not start during work", (t) => {
    t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
    const { api, audios, pressPlay } = createApp();
    api.isMusic.value = true;
    api.musicTiming.value = "breaks";
    pressPlay();
    api.musicOn("cafe");
    const cafe = audios.instances.find(
        (a) => a.dataset.src === "assets/audio_cafe.mp3"
    );
    assert.equal(cafe.paused, true);
    api.fastForwardTimer();
    assert.equal(cafe.paused, false);
});

test("addTask normalises whitespace, capitalises and reads the ! priority prefix", () => {
    const { api } = createApp();
    api.newTask.value = "   buy   milk  ";
    api.addTask();
    api.newTask.value = "!call   mum";
    api.addTask();
    api.newTask.value = "   ";
    api.addTask();
    api.newTask.value = "";
    api.addTask();
    assert.deepEqual(
        api.tasks.value.map(({ id: _id, ...task }) => task),
        [
            { text: "Buy milk", completed: false, priority: false },
            { text: "Call mum", completed: false, priority: true }
        ]
    );
    assert.deepEqual(
        api.tasks.value.map((task) => task.id),
        [1, 2]
    );
    assert.equal(api.newTask.value, "");
});

test("addTask caps at 8 tasks and shows a transient message", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { api } = createApp();
    for (let i = 1; i <= 8; i++) {
        api.newTask.value = `task ${i}`;
        api.addTask();
    }
    api.newTask.value = "one too many";
    api.addTask();
    assert.equal(api.tasks.value.length, 8);
    assert.equal(api.newTask.value, "Can't add more tasks...");
    assert.equal(api.tasksFull.value, true);
    t.mock.timers.tick(3000);
    assert.equal(api.newTask.value, "");
    assert.equal(api.tasksFull.value, false);
});

test("completeTask toggles and removeTask splices after its animation delay", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { api } = createApp();
    ["a", "b", "c"].forEach((x) => {
        api.newTask.value = x;
        api.addTask();
    });
    api.completeTask(1);
    assert.equal(api.tasks.value[1].completed, true);
    api.completeTask(1);
    assert.equal(api.tasks.value[1].completed, false);
    api.completeTask(2);
    api.completeTask(99); // out of range is ignored

    api.removeTask(0);
    assert.equal(api.tasks.value.length, 3); // not yet
    assert.equal(api.removingId.value, api.tasks.value[0].id);
    t.mock.timers.tick(500);
    assert.equal(api.removingId.value, null);
    assert.deepEqual(
        api.tasks.value.map((x) => [x.text, x.completed]),
        [
            ["B", false],
            ["C", true]
        ]
    );
});

test("side panel open state drives their class and inert bindings", () => {
    const { api } = createApp();
    assert.deepEqual(
        [api.settingsOpen.value, api.todoOpen.value],
        [false, false]
    );
    api.openTab("settings");
    assert.equal(api.settingsOpen.value, true);
    api.removeOverlay("settings");
    assert.equal(api.settingsOpen.value, false);
    api.openTab("todo");
    assert.equal(api.todoOpen.value, true);
    api.removeOverlay("todo");
    assert.equal(api.todoOpen.value, false);
});

test("tab offsets follow the active tab", () => {
    const { api } = createApp();
    assert.deepEqual(api.tabStyle.value, {
        hr: { marginLeft: "0" },
        page: { marginLeft: "0" }
    });
    api.settingsTabs("add");
    assert.deepEqual(api.tabStyle.value, {
        hr: { marginLeft: "168px" },
        page: { marginLeft: "-200%" }
    });
});

test("settingsTabs tracks the active tab for aria-selected", () => {
    const { api } = createApp();
    assert.equal(api.activeTab.value, "time");
    api.settingsTabs("audio");
    assert.equal(api.activeTab.value, "audio");
    api.settingsTabs("add");
    assert.equal(api.activeTab.value, "add");
});

test("theme is applied to the root element, main container and theme-color", () => {
    const { api, document, panels, flushWatchers } = createApp();
    const meta = panels['meta[name="theme-color"]'];
    assert.equal(
        document.documentElement.classList.contains("light-theme"),
        false
    );
    assert.equal(
        panels["#main-container"].classList.contains("dark-theme"),
        true
    );
    assert.equal(meta.getAttribute("content"), "#121212");

    api.darkMode.value = false;
    flushWatchers();
    assert.equal(
        document.documentElement.classList.contains("light-theme"),
        true
    );
    assert.equal(
        panels["#main-container"].classList.contains("dark-theme"),
        false
    );
    assert.equal(meta.getAttribute("content"), "#f43147");
});

test("notification permission is requested on the first play, not at load", (t) => {
    t.mock.timers.enable({ apis: ["setInterval", "Date"] });
    const { notification, pressPlay } = createApp();
    assert.equal(notification.requests, 0);
    pressPlay();
    assert.equal(notification.requests, 1);
});

test("no permission request when notifications are disabled or already decided", (t) => {
    t.mock.timers.enable({ apis: ["setInterval", "Date"] });
    const off = createApp({
        storage: { roundRange: "4", enableNotifications: "false" }
    });
    off.pressPlay();
    assert.equal(off.notification.requests, 0);
    const granted = createApp({ notification: { permission: "granted" } });
    granted.pressPlay();
    assert.equal(granted.notification.requests, 0);
});
