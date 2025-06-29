const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

// Constants
const MAX_TASKS = 8;
const ROUND_NAMES = ["Focus on work", "Take a short break", "Take a long break"];
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

const updatePageTitle = (minutes, seconds, isWork, isCountdown, isPaused = false) => {
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

// Global state
let timerBar;

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

        // Audio state
        const musicPlaying = ref(false);
        const sound = {
            "work": new Audio("assets/audio_break.mp3"),
            "break": new Audio("assets/audio_work.mp3"),
            "finish": new Audio("assets/audio_finish.mp3")
        };
        const music = {
            "nature": new Audio("assets/audio_nature.mp3"),
            "rain": new Audio("assets/audio_rain.mp3"),
            "cafe": new Audio("assets/audio_cafe.mp3"),
            "music": new Audio("assets/audio_music.mp3")
        };

        // Todo state
        const newTask = ref("");
        const tasks = ref([]);

        // Computed properties
        const shortRoundName = computed(() => {
            for (let i = 0; i < ROUND_NAMES.length; i++) {
                if (roundName.value === ROUND_NAMES[i]) {
                    return ROUND_NAMES_SHORT[i];
                }
            }
            return "";
        });

        // Audio methods
        const soundEffect = (fx) => {
            Object.keys(sound).forEach(key => {
                sound[key].pause();
                sound[key].currentTime = 0;
            });
            
            sound[fx].volume = soundVolume.value / 100;
            sound[fx].play();
        };

        const changeVolume = () => {
            Object.keys(music).forEach(key => {
                music[key].volume = musicVolume.value / 100;
            });
        };

        const musicState = () => {
            const slider = document.querySelector("#music-slider");
            const buttons = document.querySelectorAll("#music_container button");
            
            if (isMusic.value) {
                slider.classList.remove("disabled");
                slider.disabled = false;
                buttons.forEach(el => {
                    el.classList.remove("disabled");
                    el.disabled = false;
                });
                musicOn(musicPref.value);
            } else {
                slider.classList.add("disabled");
                slider.disabled = true;
                buttons.forEach(el => {
                    el.classList.add("disabled");
                    el.disabled = true;
                });
                musicOn("");
            }
        };

        const musicOn = (fx) => {
            musicPlaying.value = false;
            Object.keys(music).forEach(key => {
                music[key].pause();
                music[key].currentTime = 0;
            });

            if (fx === "") {
                return;
            } else {
                musicPref.value = fx;
            }

            musicPlaying.value = true;
            music[musicPref.value].muted = false;
            music[musicPref.value].play();

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
            if (currentRound.value > totalRound.value || currentRound.value === totalRound.value) {
                return "finish";
            }
            return currentRound.value % 2 === 0 ? "break" : "work";
        };

        const resetTimer = () => {
            clearInterval(timerInterval);
            timerBar.set(1);
            
            minutes.value = workRange.value;
            seconds.value = 0;
            playState.value = true;
            
            // Reset round indicators (only if not in infinite mode)
            if (!infinite.value) {
                document.querySelectorAll("#rounds-container li").forEach(el => {
                    el.classList.remove("process", "active");
                });
            }
            
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
                    nowDate.value = Math.trunc((new Date()).getTime() / 1000);
                    
                    minutes.value = Math.trunc((newDate.value - nowDate.value) / 60) % 60;
                    seconds.value = (newDate.value - nowDate.value) % 60;
                    
                    // Update page title based on current mode
                    const isWork = roundName.value === ROUND_NAMES[0];
                    updatePageTitle(minutes.value, seconds.value, isWork, isCountdown.value, false);
                    
                    if (newDate.value - nowDate.value === 0) {
                        soundEffect(getSoundEffectType());
                    }
                    
                    if (newDate.value - nowDate.value < 0) {
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

        const updateRoundIndicator = () => {
            // Only update round indicators if not in infinite mode
            if (!infinite.value) {
                const roundIndex = Math.floor(currentRound.value / 2);
                const roundEl = document.querySelector(`#rounds-container li:nth-child(${roundIndex})`);
                if (roundEl) {
                    roundEl.classList.remove("process");
                    roundEl.classList.add("active");
                }
            }
        };

        const handleMusicForBreak = () => {
            if (musicTiming.value === "work") {
                // Only during work - stop music during breaks
                if (musicPlaying.value) musicOn("");
            } else if (musicTiming.value === "breaks" || musicTiming.value === "both") {
                // During breaks or both - start music during breaks
                if (isMusic.value && !musicPlaying.value) {
                    musicOn(musicPref.value);
                }
            }
        };

        const startCountdown = () => {
            let autoStart = true;
            
            if (currentRound.value > totalRound.value) {
                // Finished
                clearInterval(timerInterval);
                playState.value = true;
                isCountdown.value = false;
                if (!infinite.value) {
                    document.querySelectorAll("#rounds-container li").forEach(el => {
                        el.classList.remove("process");
                        el.classList.add("active");
                    });
                }
                timerBar.set(0);
                if (musicPlaying.value) musicOn("");
                
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
                    updateRoundIndicator();
                    handleMusicForBreak();
                }
            } else if (currentRound.value % 2 === 0) {
                // Short break
                autoStart = autoBreak.value;
                minutes.value = sBreakRange.value;
                totalTime.value = sBreakRange.value * 60;
                roundName.value = ROUND_NAMES[1];
                if (!infinite.value) {
                    updateRoundIndicator();
                }
                handleMusicForBreak();
            } else {
                // Work
                autoStart = !autoTodoEmpty.value ? 
                    autoPomodoro.value : 
                    (Object.keys(tasks.value).length > 0 && autoPomodoro.value);
                
                minutes.value = workRange.value;
                totalTime.value = workRange.value * 60;
                roundName.value = ROUND_NAMES[0];
                if (!infinite.value) {
                    const roundEl = document.querySelector(`#rounds-container li:nth-child(${(currentRound.value + 1) / 2})`);
                    if (roundEl) roundEl.classList.add("process");
                }
                // Handle music for work mode
                if (musicTiming.value === "breaks") {
                    // Only during breaks - stop music during work
                    if (musicPlaying.value) musicOn("");
                } else if ((musicTiming.value === "work" || musicTiming.value === "both") && isMusic.value && !musicPlaying.value) {
                    // During work or both - start music during work
                    musicOn(musicPref.value);
                }
            }
            
            nowDate.value = Math.trunc((new Date()).getTime() / 1000);
            newDate.value = nowDate.value + totalTime.value;
            isCountdown.value = true;
            timerBar.set(1);
            
            // Update page title based on current mode
            const isWork = roundName.value === ROUND_NAMES[0];
            updatePageTitle(minutes.value, seconds.value, isWork, isCountdown.value, false);
            
            if (currentRound.value === 1 || autoStart) {
                timerBar.animate(0, { duration: (totalTime.value * 1000 + 10) });
                countDownTimer();
            } else {
                playState.value = true;
            }
        };

        const playFunc = () => {
            playState.value = !playState.value;
            const playBtn = document.querySelector("#button-container > #play > div");
            
            if (playBtn.classList.contains("play")) {
                if (isCountdown.value) {
                    isPaused.value = false;
                    nowDate.value = Math.trunc((new Date()).getTime() / 1000);
                    newDate.value = nowDate.value + minutes.value * 60 + seconds.value;
                    countDownTimer();
                    timerBar.animate(0, { duration: ((newDate.value - nowDate.value) * 1000 + 10) });
                    
                    if (isMusic.value && !musicPlaying.value) {
                        const isWork = roundName.value === ROUND_NAMES[0];
                        const shouldPlayMusic = (
                            (isWork && (musicTiming.value === "work" || musicTiming.value === "both")) ||
                            (!isWork && (musicTiming.value === "breaks" || musicTiming.value === "both"))
                        );
                        if (shouldPlayMusic) {
                            musicOn(musicPref.value);
                        }
                    }
                } else {
                    currentRound.value = 1;
                    if (!infinite.value) {
                        document.querySelectorAll("#rounds-container li").forEach(el => {
                            el.classList.remove("active");
                        });
                        totalRound.value = roundRange.value * 2;
                    }
                    startCountdown();
                    if (isMusic.value && !musicPlaying.value) {
                        musicOn(musicPref.value);
                    }
                }
            } else {
                isPaused.value = true;
                timerBar.stop();
                if (musicPlaying.value) musicOn("");
                
                // Update page title when paused
                const isWork = roundName.value === ROUND_NAMES[0];
                updatePageTitle(minutes.value, seconds.value, isWork, isCountdown.value, true);
            }
        };

        const fastForwardTimer = () => {
            if (isCountdown.value) {
                soundEffect(getSoundEffectType());
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
                const slider = document.querySelector("#music-slider");
                if (slider) {
                    slider.classList.add("disabled");
                    slider.disabled = true;
                }
                document.querySelectorAll("#music_container button").forEach(el => {
                    el.classList.add("disabled");
                    el.disabled = true;
                });
                musicOn("");
                musicPref.value = "nature";
            } else {
                autoPomodoro.value = true;
                autoBreak.value = true;
                autoTodoEmpty.value = false;
                infinite.value = false;
                musicTiming.value = "work";
            }
        };

        // Todo methods
        const addTask = () => {
            if (newTask.value.length <= 0) return;
            
            if (tasks.value.length >= MAX_TASKS) {
                const textarea = document.querySelector("#todo-container #add-task-container textarea");
                if (textarea) {
                    textarea.disabled = true;
                    newTask.value = "Can't add more tasks...";
                    textarea.classList.add("alert");

                    setTimeout(() => {
                        if (newTask.value === "Can't add more tasks...") {
                            newTask.value = "";
                        }
                        textarea.classList.remove("alert");
                        textarea.disabled = false;
                    }, 3000);
                }
                return;
            }

            let isPriority = false;
            if (newTask.value.length > 0 && newTask.value[0] === "!") {
                newTask.value = newTask.value.substr(1);
                isPriority = true;
            }

            newTask.value = newTask.value.trim().replace(/\s+/g, " ");
            if (newTask.value.length > 0) {
                newTask.value = newTask.value.charAt(0).toUpperCase() + newTask.value.slice(1);
            }
            
            if (newTask.value.length <= 0) return;

            tasks.value.push({
                text: newTask.value,
                completed: false,
                priority: isPriority,
            });

            newTask.value = "";
            updateTodoContainerHeight();
        };

        const removeTask = (id) => {
            const taskEl = document.querySelector(`.task:nth-child(${id + 1})`);
            const buttonEl = document.querySelector(`.task:nth-child(${id + 1}) button`);
            
            if (taskEl) taskEl.classList.add("remove");
            if (buttonEl) buttonEl.classList.add("remove");

            setTimeout(() => {
                document.querySelectorAll(".task").forEach(el => el.classList.remove("remove"));
                document.querySelectorAll(".task button").forEach(el => el.classList.remove("remove"));
                tasks.value.splice(id, 1);

                // Refresh task completion states
                for (let i = 0; i < tasks.value.length; i++) {
                    const wasCompleted = tasks.value[i].completed;
                    tasks.value[i].completed = !tasks.value[i].completed;
                    completeTask(i);
                }
            }, 500);
            
            updateTodoContainerHeight();
        };

        const completeTask = (id) => {
            if (id >= tasks.value.length) return;
            
            tasks.value[id].completed = !tasks.value[id].completed;
            
            const taskEl = document.querySelector(`.task:nth-child(${id + 1})`);
            if (!taskEl) return;

            const spans = taskEl.querySelectorAll("span");
            const tickContainer = taskEl.querySelector(".tick-container");
            const tick = taskEl.querySelector(".tick-container .tick");

            if (tasks.value[id].completed) {
                spans.forEach(el => el.classList.add("completed"));
                if (tickContainer) tickContainer.classList.add("tick-complete");
                if (tick) tick.classList.add("draw");
            } else {
                spans.forEach(el => el.classList.remove("completed"));
                if (tickContainer) tickContainer.classList.remove("tick-complete");
                if (tick) tick.classList.remove("draw");
            }
        };

        const updateTodoContainerHeight = () => {
            const todoWindowMedia = window.matchMedia(`(max-height: ${checkTodoHeight()}px)`);
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
            const container = document.querySelector("#todo-container .container");
            const taskContainer = document.querySelector("#todo-container .container #task-container");
            
            if (!container || !taskContainer) return;
            
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

        // UI methods
        const openTab = (elem) => {
            if (elem === "settings") {
                const overlay = document.getElementsByClassName("overlay")[0];
                const container = document.querySelector("#settings-container .container");
                if (overlay) overlay.classList.add("opacBg");
                if (container) container.style.left = "20px";
            } else {
                const overlay = document.getElementsByClassName("overlay")[1];
                const container = document.querySelector("#todo-container .container");
                if (overlay) overlay.classList.add("opacBg");
                if (container) container.style.right = "20px";
            }
        };

        const removeOverlay = (elem) => {
            if (elem === "settings") {
                const overlay = document.getElementsByClassName("overlay")[0];
                const container = document.querySelector("#settings-container .container");
                if (overlay) overlay.classList.remove("opacBg");
                if (container) container.style.left = "-320px";
            } else {
                const overlay = document.getElementsByClassName("overlay")[1];
                const container = document.querySelector("#todo-container .container");
                if (overlay) overlay.classList.remove("opacBg");
                if (container) container.style.right = "-350px";
            }
        };

        const settingsTabs = (tab) => {
            const hr = document.querySelector("#settings-container .container hr");
            const pageContainer = document.querySelector("#settings-container #page-container");
            
            if (!hr || !pageContainer) return;
            
            if (tab === "time") {
                hr.style.marginLeft = "0";
                pageContainer.style.marginLeft = "0";
            } else if (tab === "audio") {
                hr.style.marginLeft = "84px";
                pageContainer.style.marginLeft = "-100%";
            } else {
                hr.style.marginLeft = "168px";
                pageContainer.style.marginLeft = "-200%";
            }
        };

        // Storage functions
        const saveToStorage = () => {
            if (typeof(Storage) !== "undefined") {
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
                
                if (!newTask.value.startsWith("Can't add more tasks...")) {
                    localStorage.setItem("newTask", newTask.value);
                } else {
                    localStorage.setItem("newTask", "");
                }
                localStorage.setItem("tasks", JSON.stringify(tasks.value));
            }
        };

        const loadFromStorage = () => {
            if (typeof(Storage) !== "undefined" && localStorage.getItem("roundRange") !== null) {
                roundRange.value = parseInt(localStorage.getItem("roundRange"));
                workRange.value = parseInt(localStorage.getItem("workRange"));
                minutes.value = parseInt(localStorage.getItem("workRange"));
                sBreakRange.value = parseInt(localStorage.getItem("sBreakRange"));
                lBreakRange.value = parseInt(localStorage.getItem("lBreakRange"));
                soundVolume.value = parseInt(localStorage.getItem("soundVolume"));
                musicVolume.value = parseInt(localStorage.getItem("musicVolume"));
                musicPref.value = localStorage.getItem("musicPref");
                autoPomodoro.value = (localStorage.getItem("autoPomodoro") === "true");
                autoBreak.value = (localStorage.getItem("autoBreak") === "true");
                autoTodoEmpty.value = (localStorage.getItem("autoTodoEmpty") === "true");
                infinite.value = (localStorage.getItem("infinite") === "true");
                // Handle migration from old musicInBreaks to new musicTiming
                const oldMusicInBreaks = localStorage.getItem("musicInBreaks");
                const storedMusicTiming = localStorage.getItem("musicTiming");
                if (storedMusicTiming) {
                    musicTiming.value = storedMusicTiming;
                } else if (oldMusicInBreaks !== null) {
                    // Migrate from old format
                    musicTiming.value = (oldMusicInBreaks === "true") ? "both" : "work";
                    localStorage.removeItem("musicInBreaks"); // Clean up old setting
                } else {
                    musicTiming.value = "work"; // Default
                }
                
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
                        tasks.value = JSON.parse(storedTasks) || [];
                    } catch (e) {
                        tasks.value = [];
                    }
                }
            } else {
                saveToStorage();
            }
        };

        // Watchers
        watch([roundRange, workRange, sBreakRange, lBreakRange, soundVolume, musicVolume, 
               musicPref, isMusic, autoPomodoro, autoBreak, autoTodoEmpty, infinite, musicTiming,
               newTask, tasks], 
              () => {
                  saveToStorage();
              }, { deep: true });

        // Lifecycle
        onMounted(() => {
            // Initialize progress bar
            timerBar = new ProgressBar.Path('#timer-path');
            timerBar.set(1);
            
            // Load settings and tasks
            loadFromStorage();
            
            // Initialize todo container height
            updateTodoContainerHeight();
            
            // Restore completed tasks visual state
            nextTick(() => {
                for (let i = 0; i < tasks.value.length; i++) {
                    if (tasks.value[i].completed) {
                        setTimeout(() => {
                            const taskEl = document.querySelector(`.task:nth-child(${i + 1})`);
                            if (taskEl) {
                                const tickContainer = taskEl.querySelector(".tick-container");
                                const tick = taskEl.querySelector(".tick-container .tick");
                                const spans = taskEl.querySelectorAll("span");
                                
                                if (tickContainer) tickContainer.classList.add("tick-complete");
                                if (tick) tick.classList.add("draw");
                                spans.forEach(el => el.classList.add("completed"));
                            }
                        }, 0);
                    }
                }
            });
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
            changeCountdown,
            changeRound,
            changeInfinite,
            resetDefault,
            
            // Audio
            changeVolume,
            musicState,
            musicOn,
            
            // Todos
            newTask,
            tasks,
            addTask,
            removeTask,
            completeTask,
            
            // UI
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
app.mount('#main-container');

// Window event listeners
window.addEventListener("load", () => {
    const todoWindowMedia = window.matchMedia("(max-height: 180px)");
    const container = document.querySelector("#todo-container .container");
    const taskContainer = document.querySelector("#todo-container .container #task-container");
    
    if (todoWindowMedia.matches && container && taskContainer) {
        container.style.top = "20px";
        container.style.transform = "translateY(0)";
        container.style.height = "calc(100% - 40px)";
        taskContainer.style.overflowY = "scroll";
        taskContainer.style.overflowX = "hidden";
        taskContainer.style.height = "calc(100% - 50px)";
    }
});

window.addEventListener("resize", () => {
    const todoWindowMedia = window.matchMedia("(max-height: 180px)");
    const container = document.querySelector("#todo-container .container");
    const taskContainer = document.querySelector("#todo-container .container #task-container");
    
    if (todoWindowMedia.matches && container && taskContainer) {
        container.style.top = "20px";
        container.style.transform = "translateY(0)";
        container.style.height = "calc(100% - 40px)";
        taskContainer.style.overflowY = "scroll";
        taskContainer.style.overflowX = "hidden";
        taskContainer.style.height = "calc(100% - 50px)";
    } else if (container && taskContainer) {
        container.style.top = "50%";
        container.style.transform = "translateY(-50%)";
        container.style.height = "auto";
        taskContainer.style.overflow = "hidden";
        taskContainer.style.height = "auto";
    }
});