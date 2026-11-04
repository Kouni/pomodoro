// Composes the real composables with fakes for the browser APIs. The
// returned api mirrors what App.vue exposes to its template.
import { nextTick } from "vue";
import { ROUND_NAMES, minuteSeconds, timerFormat } from "../../src/lib/time.js";
import { useSettings } from "../../src/composables/useSettings.js";
import { useTodo } from "../../src/composables/useTodo.js";
import { useAudio } from "../../src/composables/useAudio.js";
import { useNotifications } from "../../src/composables/useNotifications.js";
import { useTicker } from "../../src/composables/useTicker.js";
import { useTheme } from "../../src/composables/useTheme.js";
import { useTimer } from "../../src/composables/useTimer.js";
import { useUi } from "../../src/composables/useUi.js";

const fakeEl = () => {
    const classes = new Set();
    const attrs = {};
    return {
        classes,
        classList: {
            add: (...c) => c.forEach((x) => classes.add(x)),
            remove: (...c) => c.forEach((x) => classes.delete(x)),
            contains: (c) => classes.has(c),
            toggle: (c, force) => {
                if (force === undefined ? !classes.has(c) : force) {
                    classes.add(c);
                } else {
                    classes.delete(c);
                }
                return classes.has(c);
            }
        },
        attrs,
        setAttribute: (k, v) => (attrs[k] = String(v)),
        getAttribute: (k) => (k in attrs ? attrs[k] : null)
    };
};

const fakeStorage = () => {
    const store = new Map();
    return {
        store,
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
};

class FakeAudio {
    constructor(src) {
        this.src = src;
        this.dataset = {};
        this.volume = 1;
        this.currentTime = 0;
        this.muted = false;
        this.paused = true;
        this.preload = "auto";
        FakeAudio.instances.push(this);
    }
    play() {
        if (FakeAudio.throwOnPlay) {
            throw new Error("play() exploded");
        }
        this.paused = false;
        FakeAudio.played.push(this.src);
        return Promise.resolve();
    }
    pause() {
        this.paused = true;
    }
}

class FakePath {
    constructor() {
        this.calls = [];
    }
    set(v) {
        this.calls.push(["set", v]);
    }
    animate(v, opts) {
        this.calls.push(["animate", v, opts]);
    }
    stop() {
        this.calls.push(["stop"]);
    }
}

/**
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.storage] pre-seeded localStorage
 * @param {object|null} [opts.notification] Notification overrides (null = API absent)
 * @param {boolean} [opts.reducedMotion]
 * @param {{hostname:string, search:string}} [opts.location]
 */
export const createApp = ({
    storage = {},
    notification,
    reducedMotion = false,
    location = { hostname: "localhost", search: "" }
} = {}) => {
    const localStorage = fakeStorage();
    Object.entries(storage).forEach(([k, v]) => localStorage.setItem(k, v));

    let Notification;
    if (notification !== null) {
        Notification = class {
            close() {}
        };
        Object.assign(
            Notification,
            { permission: "default", requestPermission: async () => "denied" },
            notification
        );
        const request = Notification.requestPermission;
        Notification.requests = 0;
        Notification.requestPermission = async () => {
            Notification.requests++;
            return request();
        };
    }

    FakeAudio.instances = [];
    FakeAudio.played = [];
    FakeAudio.throwOnPlay = false;
    const bar = new FakePath();
    const meta = fakeEl();
    const document = {
        title: "",
        documentElement: fakeEl(),
        querySelector: (sel) =>
            sel === 'meta[name="theme-color"]' ? meta : null
    };

    const settings = useSettings({ storage: localStorage });
    const todo = useTodo({ storage: localStorage });
    const notifications = useNotifications({
        settings,
        Notification,
        serviceWorker: undefined,
        focus: () => {}
    });
    // eslint-disable-next-line prefer-const -- assigned after its users
    let timer;
    const audio = useAudio({
        settings,
        isWork: () => timer.roundName.value === ROUND_NAMES[0],
        running: () => timer.isCountdown.value,
        notify: (fx) => notifications.notifyCue(fx),
        Audio: FakeAudio
    });
    const ticker = useTicker({
        onTick: () => timer.tick(),
        createWorker: null,
        document: null
    });
    timer = useTimer({
        settings,
        todo,
        audio,
        notifications,
        ticker,
        wakeLock: { acquire() {}, release() {} },
        bar: () => bar,
        setTitle: (title) => {
            document.title = title;
        },
        minute: minuteSeconds(location),
        reducedMotion: { matches: reducedMotion }
    });
    useTheme({ darkMode: settings.darkMode, document });
    const ui = useUi();

    // What App.vue does on mount.
    bar.set(1);
    audio.musicState();

    const resetDefault = (setting) => {
        if (setting === "time") {
            settings.roundRange.value = 4;
            settings.workRange.value = 25;
            settings.sBreakRange.value = 5;
            settings.lBreakRange.value = 15;
            timer.changeCountdown();
            timer.changeRound();
        } else if (setting === "audio") {
            settings.isMusic.value = false;
            settings.soundVolume.value = 100;
            settings.musicVolume.value = 75;
            settings.musicTiming.value = "work";
            audio.musicOn("");
            settings.musicPref.value = "nature";
        } else {
            settings.autoPomodoro.value = true;
            settings.autoBreak.value = true;
            settings.autoTodoEmpty.value = false;
            settings.infinite.value = false;
            settings.musicTiming.value = "work";
            settings.darkMode.value = true;
            settings.enableNotifications.value = true;
        }
    };

    const api = {
        ...settings,
        ...todo,
        ...audio,
        ...timer,
        ...ui,
        notificationPermission: notifications.permission,
        handleNotificationToggle: notifications.handleToggle,
        resetDefault,
        timerFormat
    };

    return {
        api,
        document,
        meta,
        localStorage,
        bar,
        audios: FakeAudio,
        notification: Notification,
        pressPlay: () => api.playFunc(),
        // Vue watchers run on the microtask queue.
        flushWatchers: () => nextTick()
    };
};

export const tickSeconds = (t, n) => {
    for (let i = 0; i < n; i++) {
        t.mock.timers.tick(1000);
    }
};
