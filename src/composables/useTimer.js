import { computed, ref } from "vue";
import {
    ROUND_NAMES,
    ROUND_NAMES_SHORT,
    pageTitle,
    nowSeconds
} from "../lib/time.js";

// A failing cue, notification or music call must never take the timer
// down with it: the ticker is restarted only after these side effects run.
const safely = (fn) => {
    try {
        fn();
    } catch (error) {
        if (typeof reportError === "function") {
            reportError(error);
        }
    }
};

export const useTimer = ({
    settings,
    todo,
    audio,
    notifications,
    ticker,
    wakeLock,
    bar,
    setTitle,
    minute = 60,
    reducedMotion = { matches: false },
    now = nowSeconds
}) => {
    const minutes = ref(settings.workRange.value);
    const seconds = ref(0);
    const isCountdown = ref(false);
    const isPaused = ref(false);
    const playState = ref(true);
    const currentRound = ref(1);
    const totalRound = ref(
        settings.restored
            ? settings.infinite.value
                ? 999
                : settings.roundRange.value * 2
            : 0
    );
    const nowDate = ref(0);
    const newDate = ref(0);
    const totalTime = ref(0);
    const roundName = ref("");
    const finished = ref(false);

    const isWork = () => roundName.value === ROUND_NAMES[0];
    const shortRoundName = computed(() => {
        const i = ROUND_NAMES.indexOf(roundName.value);
        return i === -1 ? "" : ROUND_NAMES_SHORT[i];
    });

    // Round indicator: "process" = work round in progress, "active" =
    // completed work round, "" = not reached yet (or idle).
    const dotClass = (i) => {
        if (finished.value) {
            return "active";
        }
        if (!isCountdown.value && currentRound.value === 1) {
            return "";
        }
        const workIndex = Math.ceil(currentRound.value / 2);
        if (i < workIndex) {
            return "active";
        }
        if (i === workIndex) {
            return currentRound.value % 2 === 1 ? "process" : "active";
        }
        return "";
    };

    // The empty-list guard only gates starting a session; a running
    // session is never interrupted by it.
    const startBlocked = () =>
        settings.autoTodoEmpty.value && todo.tasks.value.length === 0;

    // Why the timer is not running although it looks ready. Shown inside
    // the arc so a waiting round is not mistaken for a stall.
    const waitingReason = computed(() => {
        if (!isCountdown.value) {
            return startBlocked()
                ? "The to-do list is empty. Add a task to start a pomodoro."
                : "";
        }
        if (!playState.value || isPaused.value) {
            return "";
        }
        return isWork()
            ? "Auto-start pomodoros is off. Press play to start."
            : "Auto-start breaks is off. Press play to start the break.";
    });

    const updateTitle = (paused) =>
        setTitle(
            pageTitle(
                minutes.value,
                seconds.value,
                isWork(),
                isCountdown.value,
                paused
            )
        );
    // With reduced motion the tick handler steps the bar instead of tweening.
    const animateBar = (durationMs) => {
        if (!reducedMotion.matches) {
            bar()?.animate(0, { duration: durationMs });
        }
    };

    const getSoundEffectType = () => {
        if (currentRound.value >= totalRound.value) {
            return "finish";
        }
        return currentRound.value % 2 === 0 ? "workStart" : "breakStart";
    };

    const resetTimer = () => {
        ticker.stop();
        bar()?.set(1);
        if (audio.musicPlaying.value) {
            audio.musicOn("");
        }
        minutes.value = settings.workRange.value;
        seconds.value = 0;
        playState.value = true;
        finished.value = false;
        isCountdown.value = false;
        isPaused.value = false;
        currentRound.value = 1;
        setTitle("Pomodoro Timer");
        wakeLock.release();
    };

    const tick = () => {
        if (isPaused.value || !isCountdown.value) {
            return;
        }
        nowDate.value = now();
        const remaining = newDate.value - nowDate.value;
        minutes.value = Math.trunc(remaining / 60) % 60;
        seconds.value = remaining % 60;
        if (reducedMotion.matches) {
            bar()?.set(Math.max(0, remaining) / totalTime.value);
        }
        updateTitle(false);
        // <= 0, not === 0: a throttled background tab can skip the exact
        // tick on which the deadline passes.
        if (remaining <= 0) {
            safely(() => audio.soundEffect(getSoundEffectType()));
            ticker.stop();
            minutes.value = 0;
            seconds.value = 0;
            isCountdown.value = false;
            currentRound.value++;
            startCountdown();
        }
    };

    const startCountdown = () => {
        let autoStart;
        if (currentRound.value > totalRound.value) {
            ticker.stop();
            playState.value = true;
            isCountdown.value = false;
            finished.value = true;
            bar()?.set(0);
            if (audio.musicPlaying.value) {
                audio.musicOn("");
            }
            setTitle("Pomodoro Timer");
            wakeLock.release();
            return;
        }
        if (currentRound.value === totalRound.value) {
            autoStart = settings.autoBreak.value;
            if (settings.infinite.value) {
                currentRound.value = 1;
                startCountdown();
                return;
            }
            minutes.value = settings.lBreakRange.value;
            totalTime.value = settings.lBreakRange.value * minute;
            roundName.value = ROUND_NAMES[2];
            safely(audio.handleMusicForBreak);
        } else if (currentRound.value % 2 === 0) {
            autoStart = settings.autoBreak.value;
            minutes.value = settings.sBreakRange.value;
            totalTime.value = settings.sBreakRange.value * minute;
            roundName.value = ROUND_NAMES[1];
            safely(audio.handleMusicForBreak);
        } else {
            autoStart = settings.autoPomodoro.value;
            minutes.value = settings.workRange.value;
            totalTime.value = settings.workRange.value * minute;
            roundName.value = ROUND_NAMES[0];
            safely(audio.handleMusicForWork);
        }

        nowDate.value = now();
        newDate.value = nowDate.value + totalTime.value;
        isCountdown.value = true;
        bar()?.set(1);
        if (currentRound.value === 1 || autoStart) {
            updateTitle(false);
            ticker.start();
            safely(() => animateBar(totalTime.value * 1000 + 10));
            wakeLock.acquire();
        } else {
            playState.value = true;
            updateTitle(true);
            wakeLock.release();
        }
    };

    const playFunc = () => {
        if (!isCountdown.value && startBlocked()) {
            return; // waitingReason tells the user to add a task first
        }
        const starting = playState.value; // play icon was showing
        playState.value = !starting;
        if (!starting) {
            isPaused.value = true;
            bar()?.stop();
            if (audio.musicPlaying.value) {
                audio.musicOn("");
            }
            updateTitle(true);
            wakeLock.release();
            return;
        }
        if (isCountdown.value) {
            isPaused.value = false;
            nowDate.value = now();
            newDate.value = nowDate.value + minutes.value * 60 + seconds.value;
            ticker.start();
            safely(() =>
                animateBar((newDate.value - nowDate.value) * 1000 + 10)
            );
            safely(() => {
                if (
                    settings.isMusic.value &&
                    !audio.musicPlaying.value &&
                    audio.shouldPlayMusic()
                ) {
                    audio.musicOn(settings.musicPref.value);
                }
            });
            wakeLock.acquire();
            return;
        }
        currentRound.value = 1;
        finished.value = false;
        if (!settings.infinite.value) {
            totalRound.value = settings.roundRange.value * 2;
        }
        // First user gesture: ask for notification permission here rather
        // than at page load, which browsers quietly suppress.
        if (
            settings.enableNotifications.value &&
            notifications.permission.value === "default"
        ) {
            notifications.requestPermission();
        }
        startCountdown();
    };

    const fastForwardTimer = () => {
        if (!isCountdown.value) {
            return;
        }
        safely(() => audio.soundEffect(getSoundEffectType(), false));
        ticker.stop();
        minutes.value = 0;
        seconds.value = 0;
        isCountdown.value = false;
        currentRound.value++;
        // A manual skip always starts the next round, whatever the toggles say.
        const original = {
            pomodoro: settings.autoPomodoro.value,
            break: settings.autoBreak.value
        };
        settings.autoPomodoro.value = true;
        settings.autoBreak.value = true;
        startCountdown();
        settings.autoPomodoro.value = original.pomodoro;
        settings.autoBreak.value = original.break;
    };

    const changeCountdown = () => {
        if (!isCountdown.value) {
            minutes.value = settings.workRange.value;
        }
    };
    const changeRound = () => {
        settings.infinite.value = false;
        totalRound.value = settings.roundRange.value * 2;
    };
    const changeInfinite = () => {
        if (settings.infinite.value) {
            currentRound.value = 1;
            totalRound.value = 999;
        } else {
            if (settings.roundRange.value === 0) {
                settings.roundRange.value = 4;
            }
            changeRound();
        }
    };

    return {
        minutes,
        seconds,
        isCountdown,
        isPaused,
        playState,
        currentRound,
        totalRound,
        roundName,
        shortRoundName,
        finished,
        dotClass,
        waitingReason,
        tick,
        resetTimer,
        playFunc,
        fastForwardTimer,
        changeCountdown,
        changeRound,
        changeInfinite
    };
};
