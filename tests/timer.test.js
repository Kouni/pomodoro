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

test("auto-start pomodoros honours the empty-todo guard", (t) => {
    const { api, pressPlay } = bootShort(t, { autoTodoEmpty: true });
    pressPlay();
    tickSeconds(t, 61);
    tickSeconds(t, 61);
    assert.equal(api.currentRound.value, 3);
    assert.equal(api.playState.value, true); // no tasks → not auto-started
    tickSeconds(t, 5);
    assert.equal(api.minutes.value, 1);
    assert.equal(api.seconds.value, 0);

    api.newTask.value = "Write tests";
    api.addTask();
    api.resetTimer();
    pressPlay();
    tickSeconds(t, 61);
    tickSeconds(t, 61);
    assert.equal(api.currentRound.value, 3);
    assert.equal(api.playState.value, false); // task present → auto-started
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
