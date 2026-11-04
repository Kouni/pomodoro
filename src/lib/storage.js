// localStorage schema: one key per setting, booleans and numbers stored as
// strings (unchanged from the original app so existing saves keep working).
export const DEFAULT_SETTINGS = {
    roundRange: 4,
    workRange: 25,
    sBreakRange: 5,
    lBreakRange: 15,
    soundVolume: 100,
    musicVolume: 75,
    musicPref: "nature",
    isMusic: false,
    autoPomodoro: true,
    autoBreak: true,
    autoTodoEmpty: false,
    infinite: false,
    musicTiming: "work",
    darkMode: true,
    enableNotifications: true
};
export const MUSIC_TRACKS = ["nature", "rain", "cafe", "music"];
export const MUSIC_TIMINGS = ["work", "breaks", "both"];
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const NUMBER_KEYS = [
    "roundRange",
    "workRange",
    "sBreakRange",
    "lBreakRange",
    "soundVolume",
    "musicVolume"
];
const TASKS_PLACEHOLDER = "Can't add more tasks...";

export const hasSavedSettings = (storage) =>
    storage.getItem("roundRange") !== null;

export const loadSettings = (storage) => {
    const settings = { ...DEFAULT_SETTINGS };
    // A corrupt number would give a NaN deadline and a timer that never ends.
    NUMBER_KEYS.forEach((key) => {
        const n = parseInt(storage.getItem(key));
        settings[key] = Number.isFinite(n) ? n : DEFAULT_SETTINGS[key];
    });
    if (settings.roundRange === 0) {
        settings.roundRange = 4; // left behind by an old infinite-mode bug
    }
    const musicPref = storage.getItem("musicPref");
    settings.musicPref = MUSIC_TRACKS.includes(musicPref)
        ? musicPref
        : "nature";
    [
        "isMusic",
        "autoPomodoro",
        "autoBreak",
        "autoTodoEmpty",
        "infinite"
    ].forEach((key) => {
        settings[key] = storage.getItem(key) === "true";
    });
    // Migration from the old musicInBreaks flag to musicTiming.
    const musicTiming = storage.getItem("musicTiming");
    const oldMusicInBreaks = storage.getItem("musicInBreaks");
    if (MUSIC_TIMINGS.includes(musicTiming)) {
        settings.musicTiming = musicTiming;
    } else if (oldMusicInBreaks !== null) {
        settings.musicTiming = oldMusicInBreaks === "true" ? "both" : "work";
        storage.removeItem("musicInBreaks");
    }
    ["darkMode", "enableNotifications"].forEach((key) => {
        const stored = storage.getItem(key);
        settings[key] = stored !== null ? stored === "true" : true;
    });
    return settings;
};

export const saveSettings = (storage, settings) => {
    SETTINGS_KEYS.forEach((key) => storage.setItem(key, settings[key]));
};

export const loadTasks = (storage) => {
    const newTask = storage.getItem("newTask");
    let tasks = [];
    const stored = storage.getItem("tasks");
    if (stored !== null) {
        try {
            const parsed = JSON.parse(stored);
            tasks = Array.isArray(parsed) ? parsed : [];
        } catch (_e) {
            tasks = [];
        }
    }
    return { newTask: newTask === null ? "" : newTask, tasks };
};

export const saveTasks = (storage, { newTask, tasks }) => {
    storage.setItem(
        "newTask",
        newTask.startsWith(TASKS_PLACEHOLDER) ? "" : newTask
    );
    storage.setItem("tasks", JSON.stringify(tasks));
};

export { TASKS_PLACEHOLDER };
