import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, tickSeconds } from "./harness.js";

const NOW = 1_700_000_000_000;
const useTimers = (t) =>
    t.mock.timers.enable({
        apis: ["setInterval", "setTimeout", "Date"],
        now: NOW
    });

// Boot with 1-minute rounds and 2 rounds so a full cycle is 4 phases.
const bootShort = (t, overrides = {}) => {
    useTimers(t);
    const h = createApp();
    Object.assign(h.api.workRange, { value: 1 });
    h.api.sBreakRange.value = 1;
    h.api.lBreakRange.value = 2;
    h.api.roundRange.value = 2;
    Object.entries(overrides).forEach(([k, v]) => (h.api[k].value = v));
    return h;
};

test("initial state is idle with default 25:00", () => {
    const { api, document } = createApp();
    assert.equal(api.minutes.value, 25);
    assert.equal(api.seconds.value, 0);
    assert.equal(api.isCountdown.value, false);
    assert.equal(api.isPaused.value, false);
    assert.equal(api.playState.value, true);
    assert.equal(api.currentRound.value, 1);
    assert.equal(api.totalRound.value, 0);
    assert.equal(api.roundName.value, "");
    assert.equal(document.title, "");
});

test("timerFormat pads single digits only, returns number otherwise", () => {
    const { api } = createApp();
    assert.equal(api.timerFormat(7), "07");
    assert.equal(api.timerFormat(0), "00");
    assert.equal(api.timerFormat(12), 12);
});

test("play starts round 1 as work and animates the progress bar", (t) => {
    useTimers(t);
    const { api, document, bar, pressPlay } = createApp();
    pressPlay();
    assert.equal(api.isCountdown.value, true);
    assert.equal(api.playState.value, false);
    assert.equal(api.totalRound.value, 8);
    assert.equal(api.currentRound.value, 1);
    assert.equal(api.roundName.value, "Focus on work");
    assert.equal(api.shortRoundName.value, "Work");
    assert.equal(document.title, "🔥 25:00 - Pomodoro Timer");
    assert.deepEqual(bar.calls.at(-1), [
        "animate",
        0,
        { duration: 25 * 60 * 1000 + 10 }
    ]);
});

test("countdown is derived from wall clock, not tick count", (t) => {
    useTimers(t);
    const { api, document, pressPlay } = createApp();
    pressPlay();
    tickSeconds(t, 1);
    assert.equal(api.minutes.value, 24);
    assert.equal(api.seconds.value, 59);
    assert.equal(document.title, "🔥 24:59 - Pomodoro Timer");
    tickSeconds(t, 59);
    assert.equal(api.minutes.value, 24);
    assert.equal(api.seconds.value, 0);
    // Jump the clock without ticks: display catches up on the next tick.
    t.mock.timers.setTime(NOW + 10 * 60 * 1000);
    tickSeconds(t, 1);
    assert.equal(api.minutes.value, 14);
    assert.equal(api.seconds.value, 59);
});

test("work round ends at 0: cue plays and the short break starts in the same tick", (t) => {
    const { api, document, audios, pressPlay } = bootShort(t);
    pressPlay();
    tickSeconds(t, 59);
    assert.equal(api.currentRound.value, 1);
    assert.deepEqual(audios.played, []);

    tickSeconds(t, 1);
    assert.deepEqual(audios.played, ["assets/audio_break.mp3"]);
    assert.equal(api.currentRound.value, 2);
    assert.equal(api.roundName.value, "Take a short break");
    assert.equal(api.shortRoundName.value, "Short break");
    assert.equal(api.minutes.value, 1);
    assert.equal(api.seconds.value, 0);
    assert.equal(api.isCountdown.value, true);
    assert.equal(document.title, "😴 01:00 - Pomodoro Timer");
});

test("throttled tab: a tick that lands past 0 still plays the cue and transitions", (t) => {
    // Chrome aligns background setInterval wakeups to once per minute,
    // so the tick where remaining === 0 is usually never observed.
    const { api, audios, pressPlay } = bootShort(t);
    pressPlay();
    tickSeconds(t, 30);
    t.mock.timers.tick(45_000); // one wakeup, 15 s past the deadline
    assert.equal(api.currentRound.value, 2);
    assert.equal(api.roundName.value, "Take a short break");
    assert.deepEqual(audios.played, ["assets/audio_break.mp3"]);
});

test("fast forward walks work → short → work → long → finished", (t) => {
    const { api, document, bar, audios, pressPlay } = bootShort(t);
    pressPlay();
    assert.equal(api.totalRound.value, 4);

    api.fastForwardTimer();
    assert.equal(api.currentRound.value, 2);
    assert.equal(api.roundName.value, "Take a short break");
    assert.equal(api.minutes.value, 1);

    api.fastForwardTimer();
    assert.equal(api.currentRound.value, 3);
    assert.equal(api.roundName.value, "Focus on work");

    api.fastForwardTimer();
    assert.equal(api.currentRound.value, 4);
    assert.equal(api.roundName.value, "Take a long break");
    assert.equal(api.shortRoundName.value, "Long break");
    assert.equal(api.minutes.value, 2);

    api.fastForwardTimer();
    assert.equal(api.currentRound.value, 5);
    assert.equal(api.isCountdown.value, false);
    assert.equal(api.playState.value, true);
    assert.equal(api.minutes.value, 0);
    assert.equal(document.title, "Pomodoro Timer");
    assert.deepEqual(bar.calls.at(-1), ["set", 0]);
    assert.deepEqual(audios.played, [
        "assets/audio_break.mp3",
        "assets/audio_work.mp3",
        "assets/audio_break.mp3",
        "assets/audio_finish.mp3"
    ]);

    // Fast forward is a no-op once finished; play restarts from round 1.
    api.fastForwardTimer();
    assert.equal(api.currentRound.value, 5);
    pressPlay();
    assert.equal(api.currentRound.value, 1);
    assert.equal(api.roundName.value, "Focus on work");
});

test("fast forward forces the next round to start even with auto-start off", (t) => {
    const { api, pressPlay } = bootShort(t, {
        autoBreak: false,
        autoPomodoro: false
    });
    pressPlay();
    api.fastForwardTimer();
    assert.equal(api.currentRound.value, 2);
    assert.equal(api.playState.value, false); // running, not armed
    tickSeconds(t, 1);
    assert.equal(api.seconds.value, 59);
    assert.equal(api.autoBreak.value, false); // settings restored afterwards
    assert.equal(api.autoPomodoro.value, false);
});

test("pause freezes the clock and resume continues from the paused time", (t) => {
    useTimers(t);
    const { api, document, bar, pressPlay } = createApp();
    pressPlay();
    tickSeconds(t, 10);
    pressPlay(); // pause
    assert.equal(api.isPaused.value, true);
    assert.equal(api.playState.value, true);
    assert.equal(document.title, "🔥 ⏸️ Paused - Pomodoro Timer");
    assert.deepEqual(bar.calls.at(-1), ["stop"]);
    tickSeconds(t, 30);
    assert.equal(api.minutes.value, 24);
    assert.equal(api.seconds.value, 50);

    pressPlay(); // resume
    assert.equal(api.isPaused.value, false);
    assert.deepEqual(bar.calls.at(-1), [
        "animate",
        0,
        { duration: (24 * 60 + 50) * 1000 + 10 }
    ]);
    tickSeconds(t, 1);
    assert.equal(api.minutes.value, 24);
    assert.equal(api.seconds.value, 49);
});

test("reset returns to idle at the configured work length", (t) => {
    useTimers(t);
    const { api, document, bar, pressPlay } = createApp();
    api.workRange.value = 40;
    pressPlay();
    tickSeconds(t, 5);
    api.resetTimer();
    assert.equal(api.minutes.value, 40);
    assert.equal(api.seconds.value, 0);
    assert.equal(api.isCountdown.value, false);
    assert.equal(api.isPaused.value, false);
    assert.equal(api.playState.value, true);
    assert.equal(api.currentRound.value, 1);
    assert.equal(document.title, "Pomodoro Timer");
    assert.deepEqual(bar.calls.at(-1), ["set", 1]);
    tickSeconds(t, 5);
    assert.equal(api.minutes.value, 40); // interval was cleared
});

test("auto-start breaks off: break is armed but waits for play", (t) => {
    const { api, pressPlay } = bootShort(t, { autoBreak: false });
    pressPlay();
    tickSeconds(t, 61);
    assert.equal(api.currentRound.value, 2);
    assert.equal(api.roundName.value, "Take a short break");
    assert.equal(api.isCountdown.value, true);
    assert.equal(api.playState.value, true);
    tickSeconds(t, 5);
    assert.equal(api.minutes.value, 1);
    assert.equal(api.seconds.value, 0);

    pressPlay();
    tickSeconds(t, 1);
    assert.equal(api.minutes.value, 0);
    assert.equal(api.seconds.value, 59);
});

test("auto-start pomodoros off: work round after a break waits for play", (t) => {
    const { api, pressPlay } = bootShort(t, { autoPomodoro: false });
    pressPlay();
    tickSeconds(t, 61); // into short break (auto)
    tickSeconds(t, 61); // break over, work armed
    assert.equal(api.currentRound.value, 3);
    assert.equal(api.roundName.value, "Focus on work");
    assert.equal(api.playState.value, true);
    tickSeconds(t, 5);
    assert.equal(api.minutes.value, 1);
});

test("infinite mode cycles rounds without finishing", (t) => {
    const { api, pressPlay } = bootShort(t);
    api.infinite.value = true;
    api.changeInfinite();
    assert.equal(api.totalRound.value, 999);
    pressPlay();
    assert.equal(api.totalRound.value, 999); // roundRange*2 is skipped
    for (let i = 0; i < 6; i++) {
        api.fastForwardTimer();
    }
    assert.equal(api.currentRound.value, 7);
    assert.equal(api.isCountdown.value, true);
    assert.equal(api.roundName.value, "Focus on work");
});

test("reduced motion steps the progress bar instead of tweening it", (t) => {
    useTimers(t);
    const { api, bar, pressPlay } = createApp({ reducedMotion: true });
    api.workRange.value = 1;
    pressPlay();
    assert.equal(
        bar.calls.some((c) => c[0] === "animate"),
        false
    );
    tickSeconds(t, 15);
    assert.deepEqual(bar.calls.at(-1), ["set", 45 / 60]);
});

test("round indicator classes are derived from the timer state", (t) => {
    const { api, pressPlay } = bootShort(t);
    const dots = () => [1, 2].map((i) => api.dotClass(i));
    assert.deepEqual(dots(), ["", ""]);
    pressPlay();
    assert.deepEqual(dots(), ["process", ""]);
    tickSeconds(t, 60);
    assert.deepEqual(dots(), ["active", ""]);
    tickSeconds(t, 60);
    assert.deepEqual(dots(), ["active", "process"]);
    tickSeconds(t, 60);
    assert.deepEqual(dots(), ["active", "active"]);
    tickSeconds(t, 120);
    assert.equal(api.isCountdown.value, false);
    assert.deepEqual(dots(), ["active", "active"]);
    pressPlay();
    assert.deepEqual(dots(), ["process", ""]);
    api.resetTimer();
    assert.deepEqual(dots(), ["", ""]);
});

test("a throwing audio cue does not stop the round transition", (t) => {
    const { api, audios, pressPlay } = bootShort(t, { isMusic: true });
    pressPlay();
    audios.throwOnPlay = true;
    tickSeconds(t, 60);
    assert.equal(api.roundName.value, "Take a short break");
    tickSeconds(t, 1);
    assert.equal(api.seconds.value, 59); // the new interval is running
    tickSeconds(t, 59);
    assert.equal(api.roundName.value, "Focus on work");
    assert.equal(api.currentRound.value, 3);
});

test("the empty-to-do guard only blocks starting a session", (t) => {
    const { api, pressPlay } = bootShort(t, { autoTodoEmpty: true });
    pressPlay();
    assert.equal(api.isCountdown.value, false);
    assert.equal(api.playState.value, true);
    assert.equal(
        api.waitingReason.value,
        "The to-do list is empty. Add a task to start a pomodoro."
    );

    api.newTask.value = "Write tests";
    api.addTask();
    assert.equal(api.waitingReason.value, "");
    pressPlay();
    assert.equal(api.isCountdown.value, true);
    api.tasks.value.splice(0, 1); // list emptied mid-session
    tickSeconds(t, 61);
    tickSeconds(t, 61);
    assert.equal(api.currentRound.value, 3);
    assert.equal(api.roundName.value, "Focus on work");
    assert.equal(api.playState.value, false); // still auto-started
    assert.equal(api.seconds.value, 58); // 2 s into round 3
});

test("an armed break explains why it is waiting", (t) => {
    const { api, document, pressPlay } = bootShort(t, { autoBreak: false });
    assert.equal(api.waitingReason.value, "");
    pressPlay();
    assert.equal(api.waitingReason.value, "");
    tickSeconds(t, 60);
    assert.equal(api.roundName.value, "Take a short break");
    assert.equal(
        api.waitingReason.value,
        "Auto-start breaks is off. Press play to start the break."
    );
    assert.equal(document.title, "😴 ⏸️ Paused - Pomodoro Timer");
    pressPlay();
    assert.equal(api.waitingReason.value, "");
});

test("an armed work round explains why it is waiting, a paused one does not", (t) => {
    const { api, pressPlay } = bootShort(t, { autoPomodoro: false });
    pressPlay();
    tickSeconds(t, 120);
    assert.equal(api.roundName.value, "Focus on work");
    assert.equal(
        api.waitingReason.value,
        "Auto-start pomodoros is off. Press play to start."
    );
    pressPlay(); // starts round 3
    assert.equal(api.waitingReason.value, "");
    pressPlay(); // pauses it: no hint
    assert.equal(api.isPaused.value, true);
    assert.equal(api.waitingReason.value, "");
});

// Regression for the reported "second pomodoro never counts" with the
// empty-list guard on: a four-round session must run every round to the end.
test("a four-round session runs every round even when the to-do list empties", (t) => {
    const { api, pressPlay } = bootShort(t, {
        roundRange: 4,
        autoTodoEmpty: true
    });
    api.newTask.value = "plan the day";
    api.addTask();
    pressPlay();
    api.tasks.value.splice(0, 1);

    const expected = [
        "Focus on work",
        "Take a short break",
        "Focus on work",
        "Take a short break",
        "Focus on work",
        "Take a short break",
        "Focus on work",
        "Take a long break"
    ];
    expected.forEach((name, i) => {
        assert.equal(api.roundName.value, name, `round ${i + 1}`);
        assert.equal(api.playState.value, false, `round ${i + 1} is running`);
        assert.equal(api.waitingReason.value, "");
        tickSeconds(t, 1);
        assert.equal(api.seconds.value, 59, `round ${i + 1} counts`);
        tickSeconds(t, i === 7 ? 119 : 59); // the long break is 2 minutes
    });
    assert.equal(api.isCountdown.value, false);
    assert.equal(api.playState.value, true);
    assert.equal(api.currentRound.value, 9);

    pressPlay(); // a new session is gated again by the empty list
    assert.equal(api.isCountdown.value, false);
    assert.equal(
        api.waitingReason.value,
        "The to-do list is empty. Add a task to start a pomodoro."
    );
});

test("?minute=N shortens rounds on a local server only", (t) => {
    useTimers(t);
    const fast = createApp({
        location: { hostname: "127.0.0.1", search: "?minute=2" }
    });
    fast.api.workRange.value = 1;
    fast.pressPlay();
    tickSeconds(t, 2);
    assert.equal(fast.api.roundName.value, "Take a short break");

    const deployed = createApp({
        location: { hostname: "tomato.kouni.io", search: "?minute=2" }
    });
    deployed.api.workRange.value = 1;
    deployed.pressPlay();
    tickSeconds(t, 2);
    assert.equal(deployed.api.roundName.value, "Focus on work");
    assert.equal(deployed.api.seconds.value, 58);
});
