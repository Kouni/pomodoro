const { createApp, ref, computed, watch, onMounted, nextTick } = Vue;

// Constants
const MAX_TASKS = 8;
const ROUND_NAMES = [
    "Focus on work",
    "Take a short break",
    "Take a long break"
];
const ROUND_NAMES_SHORT = ["Work", "Short break", "Long break"];

// Utility functions
const timerFormat = (value) => {
    return value.toString().length === 1 ? "0" + value : value;
};

const formatTimeForTitle = (minutes, seconds) => {
    if (minutes > 99) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${timerFormat(hours)}:${timerFormat(mins)}:${timerFormat(seconds)}`;
    } else {
        return `${timerFormat(minutes)}:${timerFormat(seconds)}`;
    }
};

const updatePageTitle = (
    minutes,
    seconds,
    isWork,
    isCountdown,
    isPaused = false
) => {
    if (isPaused && isCountdown) {
        const emoji = isWork ? "🔥" : "😴";
        document.title = `${emoji} ⏸️ Paused - Pomodoro Timer`;
    } else if (isCountdown) {
        if (isWork) {
            document.title = `🔥 ${formatTimeForTitle(minutes, seconds)} - Pomodoro Timer`;
        } else {
            document.title = `😴 ${formatTimeForTitle(minutes, seconds)} - Pomodoro Timer`;
        }
    } else {
        document.title = "Pomodoro Timer";
    }
};

// Autoplay policy may reject play(); audio cues are best effort.
const playSafely = (audio) => {
    const result = audio.play();
    if (result && typeof result.catch === "function") {
        result.catch(() => {});
    }
};

// A failing cue, notification or music call must never take the timer
// down with it: the interval is rebuilt only after these side effects run.
const safely = (fn) => {
    try {
        fn();
    } catch (error) {
        if (typeof reportError === "function") {
            reportError(error);
        }
    }
};

// Global state
let timerBar;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// With reduced motion the tick handler steps the bar instead of tweening.
const animateBar = (durationMs) => {
    if (!reducedMotion.matches) {
        timerBar.animate(0, { duration: durationMs });
    }
};

// Main Vue application
const app = createApp({
    setup() {
        // Timer state
        const minutes = ref(25);
        const seconds = ref(0);
        const isCountdown = ref(false);
        const isPaused = ref(false);
        const playState = ref(true);
        const currentRound = ref(1);
        const totalRound = ref(0);
        const nowDate = ref(0);
        const newDate = ref(0);
        const totalTime = ref(0);
        const roundName = ref("");
        const finished = ref(false);
        let timerInterval = null;

        // Settings state
        const roundRange = ref(4);
        const workRange = ref(25);
        const sBreakRange = ref(5);
        const lBreakRange = ref(15);
        const soundVolume = ref(100);
        const musicVolume = ref(75);
        const musicPref = ref("nature");
        const isMusic = ref(false);
        const autoPomodoro = ref(true);
        const autoBreak = ref(true);
        const autoTodoEmpty = ref(false);
        const infinite = ref(false);
        const musicTiming = ref("work"); // "work", "breaks", "both"
        const darkMode = ref(true);

        // Audio state
        const musicPlaying = ref(false);
        // Keyed by what the cue announces, not by the round that just ended.
        const sound = {
            breakStart: new Audio("assets/audio_break.mp3"),
            workStart: new Audio("assets/audio_work.mp3"),
            finish: new Audio("assets/audio_finish.mp3")
        };
        // Music tracks are 25-28 MB each; fetch them on first play only.
        // preload has to be set before src: WebKit starts loading on src.
        const lazyAudio = (src) => {
            const track = new Audio();
            track.preload = "none";
            track.src = src;
            return track;
        };
        const music = {
            nature: lazyAudio("assets/audio_nature.mp3"),
            rain: lazyAudio("assets/audio_rain.mp3"),
            cafe: lazyAudio("assets/audio_cafe.mp3"),
            music: lazyAudio("assets/audio_music.mp3")
        };

        // Notification state
        const notificationPermission = ref(
            "Notification" in window ? Notification.permission : "denied"
        );
        const enableNotifications = ref(true);

        // Todo state
        const newTask = ref("");
        const tasks = ref([]);
        const tasksFull = ref(false);
        const removingId = ref(null);
        let taskSeq = 0;
        const nextTaskId = () => ++taskSeq;

        // UI state
        const activeTab = ref("time");
        const settingsOpen = ref(false);
        const todoOpen = ref(false);
        const TAB_OFFSETS = {
            time: ["0", "0"],
            audio: ["84px", "-100%"],
            add: ["168px", "-200%"]
        };
        const tabStyle = computed(() => ({
            hr: { marginLeft: TAB_OFFSETS[activeTab.value][0] },
            page: { marginLeft: TAB_OFFSETS[activeTab.value][1] }
        }));

        // Computed properties
        const shortRoundName = computed(() => {
            for (let i = 0; i < ROUND_NAMES.length; i++) {
                if (roundName.value === ROUND_NAMES[i]) {
                    return ROUND_NAMES_SHORT[i];
                }
            }
            return "";
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

        const shouldPlayMusic = () => {
            const isWork = roundName.value === ROUND_NAMES[0];
            return isWork
                ? ["work", "both"].includes(musicTiming.value)
                : ["breaks", "both"].includes(musicTiming.value);
        };

        // Notification methods
        const requestNotificationPermission = async () => {
            if (!("Notification" in window)) {
                return false;
            }

            if (Notification.permission === "granted") {
                notificationPermission.value = "granted";
                return true;
            }

            if (Notification.permission !== "denied") {
                try {
                    // For Chrome/Brave compatibility, ensure we handle the permission request properly
                    const permission = await Notification.requestPermission();
                    notificationPermission.value = permission;
                    return permission === "granted";
                } catch (_error) {
                    return false;
                }
            }

            return false;
        };

        const showNotification = (
            title,
            message,
            icon = "assets/favicon/favicon-32x32.png"
        ) => {
            if (
                !enableNotifications.value ||
                notificationPermission.value !== "granted"
            ) {
                return;
            }

            try {
                // Simplified notification options for better Chrome/Brave compatibility
                const notification = new Notification(title, {
                    body: message,
                    icon: icon,
                    tag: "pomodoro-timer",
                    silent: false
                    // Remove requireInteraction for Chrome compatibility
                    // requireInteraction: true
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                // Auto close notification after 8 seconds for better UX
                setTimeout(() => {
                    try {
                        notification.close();
                    } catch (_e) {
                        // Ignore errors when closing notifications
                    }
                }, 8000);
            } catch (_error) {
                // Failed to show notification - ignore
            }
        };

        // Audio methods
        const soundEffect = (fx, enableNotificationSound = true) => {
            Object.keys(sound).forEach((key) => {
                sound[key].pause();
                sound[key].currentTime = 0;
            });

            sound[fx].volume = soundVolume.value / 100;
            playSafely(sound[fx]);

            // Show notification based on timer state (only if showNotification is true)
            if (
                enableNotificationSound &&
                enableNotifications.value &&
                notificationPermission.value === "granted"
            ) {
                let title, message;

                if (fx === "finish") {
                    title = "Pomodoro Session Complete!";
                    message = "All rounds completed. Great job!";
                } else if (fx === "breakStart") {
                    title = "Break Time!";
                    message = "Time to take a well-deserved break.";
                } else if (fx === "workStart") {
                    title = "Work Time!";
                    message = "Break's over. Time to focus and get productive!";
                }

                // Only show notification if title and message are defined
                if (title && message) {
                    showNotification(title, message);
                }
            }
        };

        const changeVolume = () => {
            Object.keys(music).forEach((key) => {
                music[key].volume = musicVolume.value / 100;
            });
        };

        // The controls' disabled state is bound to isMusic in the template.
        const musicState = () => {
            if (!isMusic.value) {
                musicOn("");
            } else if (isCountdown.value && shouldPlayMusic()) {
                musicOn(musicPref.value);
            }
        };

        const musicOn = (fx) => {
            musicPlaying.value = false;
            Object.keys(music).forEach((key) => {
                music[key].pause();
                music[key].currentTime = 0;
            });

            if (fx === "") {
                return;
            } else {
                musicPref.value = fx;
            }

            if (isCountdown.value && !shouldPlayMusic()) {
                return;
            }

            musicPlaying.value = true;
            music[musicPref.value].muted = false;
            playSafely(music[musicPref.value]);

            if (fx === "nature") {
                music[musicPref.value].volume = 0;
                let i = 0;
                const volumeLoop = () => {
                    setTimeout(() => {
                        i++;
                        music[musicPref.value].volume = i / 100;
                        if (i < musicVolume.value) {
                            volumeLoop();
                        }
                    }, 30);
                };
                volumeLoop();
            }
        };

        // Timer methods
        const getSoundEffectType = () => {
            if (
                currentRound.value > totalRound.value ||
                currentRound.value === totalRound.value
            ) {
                return "finish";
            }
            return currentRound.value % 2 === 0 ? "workStart" : "breakStart";
        };

        const resetTimer = () => {
            clearInterval(timerInterval);
            timerBar.set(1);

            // Stop music if playing
            if (musicPlaying.value) {
                musicOn("");
            }

            minutes.value = workRange.value;
            seconds.value = 0;
            playState.value = true;
            finished.value = false;
            isCountdown.value = false;
            isPaused.value = false;
            currentRound.value = 1;

            // Reset page title
            updatePageTitle(minutes.value, seconds.value, false, false, false);
        };

        const countDownTimer = () => {
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                if (!isPaused.value) {
                    nowDate.value = Math.trunc(new Date().getTime() / 1000);

                    minutes.value =
                        Math.trunc((newDate.value - nowDate.value) / 60) % 60;
                    seconds.value = (newDate.value - nowDate.value) % 60;
                    if (reducedMotion.matches) {
                        timerBar.set(
                            Math.max(0, newDate.value - nowDate.value) /
                                totalTime.value
                        );
                    }

                    // Update page title based on current mode
                    const isWork = roundName.value === ROUND_NAMES[0];
                    updatePageTitle(
                        minutes.value,
                        seconds.value,
                        isWork,
                        isCountdown.value,
                        false
                    );

                    // <= 0, not === 0: a throttled background tab can skip
                    // the exact tick on which the deadline passes.
                    if (newDate.value - nowDate.value <= 0) {
                        safely(() => soundEffect(getSoundEffectType()));
                        clearInterval(timerInterval);
                        minutes.value = 0;
                        seconds.value = 0;
                        isCountdown.value = false;
                        currentRound.value++;
                        startCountdown();
                    }
                }
            }, 1000);
        };

        const handleMusicForBreak = () => {
            if (musicTiming.value === "work") {
                // Only during work - stop music during breaks
                if (musicPlaying.value) {
                    musicOn("");
                }
            } else if (
                musicTiming.value === "breaks" ||
                musicTiming.value === "both"
            ) {
                // During breaks or both - start music during breaks
                if (isMusic.value && !musicPlaying.value) {
                    musicOn(musicPref.value);
                }
            }
        };

        const startCountdown = () => {
            let autoStart;

            if (currentRound.value > totalRound.value) {
                // Finished
                clearInterval(timerInterval);
                playState.value = true;
                isCountdown.value = false;
                finished.value = true;
                timerBar.set(0);
                if (musicPlaying.value) {
                    musicOn("");
                }

                // Reset page title to default when all rounds are completed
                document.title = "Pomodoro Timer";
                return;
            }

            if (currentRound.value === totalRound.value) {
                // Long break
                autoStart = autoBreak.value;
                if (infinite.value) {
                    currentRound.value = 1;
                    startCountdown();
                    return;
                } else {
                    minutes.value = lBreakRange.value;
                    totalTime.value = lBreakRange.value * 60;
                    roundName.value = ROUND_NAMES[2];
                    safely(handleMusicForBreak);
                }
            } else if (currentRound.value % 2 === 0) {
                // Short break
                autoStart = autoBreak.value;
                minutes.value = sBreakRange.value;
                totalTime.value = sBreakRange.value * 60;
                roundName.value = ROUND_NAMES[1];
                safely(handleMusicForBreak);
            } else {
                // Work
                autoStart = !autoTodoEmpty.value
                    ? autoPomodoro.value
                    : Object.keys(tasks.value).length > 0 && autoPomodoro.value;

                minutes.value = workRange.value;
                totalTime.value = workRange.value * 60;
                roundName.value = ROUND_NAMES[0];
                safely(() => {
                    if (musicTiming.value === "breaks") {
                        if (musicPlaying.value) {
                            musicOn("");
                        }
                    } else if (
                        isMusic.value &&
                        !musicPlaying.value &&
                        shouldPlayMusic()
                    ) {
                        musicOn(musicPref.value);
                    }
                });
            }

            nowDate.value = Math.trunc(new Date().getTime() / 1000);
            newDate.value = nowDate.value + totalTime.value;
            isCountdown.value = true;
            timerBar.set(1);

            // Update page title based on current mode
            const isWork = roundName.value === ROUND_NAMES[0];
            updatePageTitle(
                minutes.value,
                seconds.value,
                isWork,
                isCountdown.value,
                false
            );

            if (currentRound.value === 1 || autoStart) {
                countDownTimer();
                safely(() => animateBar(totalTime.value * 1000 + 10));
            } else {
                playState.value = true;
            }
        };

        const playFunc = () => {
            const starting = playState.value; // play icon was showing
            playState.value = !starting;

            if (starting) {
                if (isCountdown.value) {
                    isPaused.value = false;
                    nowDate.value = Math.trunc(new Date().getTime() / 1000);
                    newDate.value =
                        nowDate.value + minutes.value * 60 + seconds.value;
                    countDownTimer();
                    safely(() =>
                        animateBar((newDate.value - nowDate.value) * 1000 + 10)
                    );
                    safely(() => {
                        if (
                            isMusic.value &&
                            !musicPlaying.value &&
                            shouldPlayMusic()
                        ) {
                            musicOn(musicPref.value);
                        }
                    });
                } else {
                    currentRound.value = 1;
                    finished.value = false;
                    if (!infinite.value) {
                        totalRound.value = roundRange.value * 2;
                    }
                    // First user gesture: ask for notification permission here
                    // rather than at page load, which browsers quietly suppress.
                    if (
                        enableNotifications.value &&
                        notificationPermission.value === "default"
                    ) {
                        requestNotificationPermission();
                    }
                    startCountdown();
                }
            } else {
                isPaused.value = true;
                timerBar.stop();
                if (musicPlaying.value) {
                    musicOn("");
                }

                // Update page title when paused
                const isWork = roundName.value === ROUND_NAMES[0];
                updatePageTitle(
                    minutes.value,
                    seconds.value,
                    isWork,
                    isCountdown.value,
                    true
                );
            }
        };

        const fastForwardTimer = () => {
            if (isCountdown.value) {
                safely(() => soundEffect(getSoundEffectType(), false));
                clearInterval(timerInterval);
                minutes.value = 0;
                seconds.value = 0;
                isCountdown.value = false;
                currentRound.value++;

                // For manual fast forward, we want to force start the next round
                // regardless of autoStart settings
                const originalAutoStart = {
                    pomodoro: autoPomodoro.value,
                    break: autoBreak.value
                };

                // Temporarily enable auto start for this transition
                autoPomodoro.value = true;
                autoBreak.value = true;

                startCountdown();

                // Restore original autoStart settings
                autoPomodoro.value = originalAutoStart.pomodoro;
                autoBreak.value = originalAutoStart.break;
            }
        };

        // Settings methods
        const changeCountdown = () => {
            if (!isCountdown.value) {
                minutes.value = workRange.value;
            }
        };

        const changeRound = () => {
            infinite.value = false;
            totalRound.value = roundRange.value * 2;
        };

        const changeInfinite = () => {
            if (infinite.value) {
                // When enabling infinite mode, don't change roundRange value
                // Just set appropriate totalRound for infinite cycles
                currentRound.value = 1;
                totalRound.value = 999; // Use a large number for infinite mode
            } else {
                // When disabling infinite mode, restore proper round behavior
                if (roundRange.value === 0) {
                    // If roundRange was 0, restore default value
                    roundRange.value = 4;
                }
                changeRound();
            }
        };

        const handleNotificationToggle = async () => {
            if (enableNotifications.value) {
                const granted = await requestNotificationPermission();
                if (!granted) {
                    enableNotifications.value = false;
                }
            }
        };

        const resetDefault = (setting) => {
            if (setting === "time") {
                roundRange.value = 4;
                workRange.value = minutes.value = 25;
                sBreakRange.value = 5;
                lBreakRange.value = 15;
                changeCountdown();
                changeRound();
            } else if (setting === "audio") {
                isMusic.value = false;
                soundVolume.value = 100;
                musicVolume.value = 75;
                musicTiming.value = "work";
                musicOn("");
                musicPref.value = "nature";
            } else {
                autoPomodoro.value = true;
                autoBreak.value = true;
                autoTodoEmpty.value = false;
                infinite.value = false;
                musicTiming.value = "work";
                darkMode.value = true;
                enableNotifications.value = true;
            }
        };

        // Todo methods
        const addTask = () => {
            if (newTask.value.length <= 0) {
                return;
            }

            if (tasks.value.length >= MAX_TASKS) {
                tasksFull.value = true;
                newTask.value = "Can't add more tasks...";
                setTimeout(() => {
                    if (newTask.value === "Can't add more tasks...") {
                        newTask.value = "";
                    }
                    tasksFull.value = false;
                }, 3000);
                return;
            }

            let isPriority = false;
            if (newTask.value.length > 0 && newTask.value[0] === "!") {
                newTask.value = newTask.value.substr(1);
                isPriority = true;
            }

            newTask.value = newTask.value.trim().replace(/\s+/g, " ");
            if (newTask.value.length > 0) {
                newTask.value =
                    newTask.value.charAt(0).toUpperCase() +
                    newTask.value.slice(1);
            }

            if (newTask.value.length <= 0) {
                return;
            }

            tasks.value.push({
                id: nextTaskId(),
                text: newTask.value,
                completed: false,
                priority: isPriority
            });

            newTask.value = "";
            updateTodoContainerHeight();
        };

        const removeTask = (index) => {
            const { id } = tasks.value[index];
            removingId.value = id; // drives the exit animation class
            setTimeout(() => {
                const i = tasks.value.findIndex((task) => task.id === id);
                if (i !== -1) {
                    tasks.value.splice(i, 1);
                }
                removingId.value = null;
            }, 500);

            updateTodoContainerHeight();
        };

        const completeTask = (index) => {
            if (index >= tasks.value.length) {
                return;
            }
            tasks.value[index].completed = !tasks.value[index].completed;
        };

        const updateTodoContainerHeight = () => {
            const todoWindowMedia = window.matchMedia(
                `(max-height: ${checkTodoHeight()}px)`
            );
            adaptTodoContainer(todoWindowMedia);
        };

        const checkTodoHeight = () => {
            if (tasks.value.length === 0) {
                return 101 + 40;
            } else if (tasks.value.length === 1) {
                return 130 + 40;
            } else if (tasks.value.length > 1 && tasks.value.length <= 8) {
                return 130 + (tasks.value.length - 1) * 65 + 40;
            }
        };

        const adaptTodoContainer = (media) => {
            const container = document.querySelector(
                "#todo-container .container"
            );
            const taskContainer = document.querySelector(
                "#todo-container .container #task-container"
            );

            if (!container || !taskContainer) {
                return;
            }

            if (media.matches) {
                container.style.top = "20px";
                container.style.transform = "translateY(0)";
                container.style.height = "calc(100% - 40px)";
                taskContainer.style.overflowY = "scroll";
                taskContainer.style.overflowX = "hidden";
                taskContainer.style.height = "calc(100% - 50px)";
            } else {
                container.style.top = "50%";
                container.style.transform = "translateY(-50%)";
                container.style.height = "auto";
                taskContainer.style.overflow = "hidden";
                taskContainer.style.height = "auto";
            }
        };

        // UI methods: panels and tabs are rendered from these refs (the
        // closed panels are inert so keyboard focus cannot reach them).
        const openTab = (elem) => {
            if (elem === "settings") {
                settingsOpen.value = true;
            } else {
                todoOpen.value = true;
            }
        };

        const removeOverlay = (elem) => {
            if (elem === "settings") {
                settingsOpen.value = false;
            } else {
                todoOpen.value = false;
            }
        };

        const settingsTabs = (tab) => {
            activeTab.value = tab;
        };

        // Storage functions
        const saveToStorage = () => {
            if (typeof Storage !== "undefined") {
                localStorage.setItem("roundRange", roundRange.value);
                localStorage.setItem("workRange", workRange.value);
                localStorage.setItem("sBreakRange", sBreakRange.value);
                localStorage.setItem("lBreakRange", lBreakRange.value);
                localStorage.setItem("soundVolume", soundVolume.value);
                localStorage.setItem("musicVolume", musicVolume.value);
                localStorage.setItem("musicPref", musicPref.value);
                localStorage.setItem("isMusic", isMusic.value);
                localStorage.setItem("autoPomodoro", autoPomodoro.value);
                localStorage.setItem("autoBreak", autoBreak.value);
                localStorage.setItem("autoTodoEmpty", autoTodoEmpty.value);
                localStorage.setItem("infinite", infinite.value);
                localStorage.setItem("musicTiming", musicTiming.value);
                localStorage.setItem("darkMode", darkMode.value);
                localStorage.setItem(
                    "enableNotifications",
                    enableNotifications.value
                );

                if (!newTask.value.startsWith("Can't add more tasks...")) {
                    localStorage.setItem("newTask", newTask.value);
                } else {
                    localStorage.setItem("newTask", "");
                }
                localStorage.setItem("tasks", JSON.stringify(tasks.value));
            }
        };

        const loadFromStorage = () => {
            if (
                typeof Storage !== "undefined" &&
                localStorage.getItem("roundRange") !== null
            ) {
                // A corrupt number would give a NaN deadline and a timer that never ends.
                const storedInt = (key, fallback) => {
                    const n = parseInt(localStorage.getItem(key));
                    return Number.isFinite(n) ? n : fallback;
                };
                roundRange.value = storedInt("roundRange", 4);
                workRange.value = storedInt("workRange", 25);
                minutes.value = workRange.value;
                sBreakRange.value = storedInt("sBreakRange", 5);
                lBreakRange.value = storedInt("lBreakRange", 15);
                soundVolume.value = storedInt("soundVolume", 100);
                musicVolume.value = storedInt("musicVolume", 75);
                const storedMusicPref = localStorage.getItem("musicPref");
                musicPref.value = Object.hasOwn(music, storedMusicPref)
                    ? storedMusicPref
                    : "nature";
                isMusic.value = localStorage.getItem("isMusic") === "true";
                autoPomodoro.value =
                    localStorage.getItem("autoPomodoro") === "true";
                autoBreak.value = localStorage.getItem("autoBreak") === "true";
                autoTodoEmpty.value =
                    localStorage.getItem("autoTodoEmpty") === "true";
                infinite.value = localStorage.getItem("infinite") === "true";
                // Handle migration from old musicInBreaks to new musicTiming
                const oldMusicInBreaks = localStorage.getItem("musicInBreaks");
                const storedMusicTiming = localStorage.getItem("musicTiming");
                if (["work", "breaks", "both"].includes(storedMusicTiming)) {
                    musicTiming.value = storedMusicTiming;
                } else if (oldMusicInBreaks !== null) {
                    // Migrate from old format
                    musicTiming.value =
                        oldMusicInBreaks === "true" ? "both" : "work";
                    localStorage.removeItem("musicInBreaks"); // Clean up old setting
                } else {
                    musicTiming.value = "work"; // Default
                }

                const storedDarkMode = localStorage.getItem("darkMode");
                darkMode.value =
                    storedDarkMode !== null ? storedDarkMode === "true" : true;

                const storedEnableNotifications = localStorage.getItem(
                    "enableNotifications"
                );
                enableNotifications.value =
                    storedEnableNotifications !== null
                        ? storedEnableNotifications === "true"
                        : true;

                // Fix roundRange if it was set to 0 due to previous infinite mode bug
                if (roundRange.value === 0) {
                    roundRange.value = 4;
                }

                // Set proper totalRound based on infinite mode
                if (infinite.value) {
                    totalRound.value = 999; // Large number for infinite mode
                } else {
                    totalRound.value = roundRange.value * 2;
                }

                const storedNewTask = localStorage.getItem("newTask");
                if (storedNewTask !== null) {
                    newTask.value = storedNewTask;
                }

                const storedTasks = localStorage.getItem("tasks");
                if (storedTasks !== null) {
                    try {
                        const parsed = JSON.parse(storedTasks);
                        tasks.value = Array.isArray(parsed) ? parsed : [];
                        // Stable ids for v-for keys; older saves have none.
                        taskSeq = Math.max(
                            0,
                            ...tasks.value
                                .map((task) => task.id)
                                .filter(Number.isInteger)
                        );
                        tasks.value.forEach((task) => {
                            if (!Number.isInteger(task.id)) {
                                task.id = nextTaskId();
                            }
                        });
                    } catch (_e) {
                        tasks.value = [];
                    }
                }
            } else {
                saveToStorage();
            }
        };

        // Watchers
        watch(
            [
                roundRange,
                workRange,
                sBreakRange,
                lBreakRange,
                soundVolume,
                musicVolume,
                musicPref,
                isMusic,
                autoPomodoro,
                autoBreak,
                autoTodoEmpty,
                infinite,
                musicTiming,
                darkMode,
                enableNotifications,
                newTask,
                tasks
            ],
            () => {
                saveToStorage();
            },
            { deep: true }
        );

        // Theme lives outside the mounted template: root element class,
        // page background and the browser chrome colour.
        const applyTheme = () => {
            const dark = darkMode.value;
            document.documentElement.classList.toggle("light-theme", !dark);
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) {
                meta.setAttribute("content", dark ? "#121212" : "#f43147");
            }
            const mainContainer = document.querySelector("#main-container");
            if (mainContainer) {
                mainContainer.classList.toggle("dark-theme", dark);
            }
        };
        watch(darkMode, applyTheme);

        // Watch for music timing changes to stop/start music accordingly
        watch(musicTiming, () => {
            if (isMusic.value) {
                if (isCountdown.value) {
                    if (shouldPlayMusic() && !musicPlaying.value) {
                        musicOn(musicPref.value);
                    } else if (!shouldPlayMusic() && musicPlaying.value) {
                        musicOn("");
                    }
                } else {
                    // If no timer is running, stop music if set to only play during breaks
                    if (musicTiming.value === "breaks" && musicPlaying.value) {
                        musicOn(""); // Stop music if only supposed to play during breaks
                    }
                }
            }
        });

        // Lifecycle
        onMounted(() => {
            // Initialize progress bar
            timerBar = new ProgressBar.Path("#timer-path");
            timerBar.set(1);

            // Load settings and tasks
            loadFromStorage();

            if ("Notification" in window) {
                notificationPermission.value = Notification.permission;
            }

            applyTheme();

            // Initialize music UI state
            nextTick(() => {
                musicState();
            });

            // Initialize todo container height
            updateTodoContainerHeight();
            window.addEventListener("resize", updateTodoContainerHeight);
        });

        // Return reactive state and methods
        return {
            // Timer
            minutes,
            seconds,
            isCountdown,
            isPaused,
            playState,
            currentRound,
            totalRound,
            roundName,
            dotClass,
            resetTimer,
            playFunc,
            fastForwardTimer,

            // Settings
            roundRange,
            workRange,
            sBreakRange,
            lBreakRange,
            soundVolume,
            musicVolume,
            musicPref,
            isMusic,
            autoPomodoro,
            autoBreak,
            autoTodoEmpty,
            infinite,
            musicTiming,
            darkMode,
            changeCountdown,
            changeRound,
            changeInfinite,
            resetDefault,

            // Audio
            changeVolume,
            musicState,
            musicOn,

            // Notifications
            enableNotifications,
            notificationPermission,
            handleNotificationToggle,

            // Todos
            newTask,
            tasks,
            tasksFull,
            removingId,
            addTask,
            removeTask,
            completeTask,

            // UI
            activeTab,
            tabStyle,
            settingsOpen,
            todoOpen,
            openTab,
            removeOverlay,
            settingsTabs,

            // Computed
            shortRoundName,

            // Utils
            timerFormat
        };
    }
});

// Mount the app
app.mount("#main-container");
