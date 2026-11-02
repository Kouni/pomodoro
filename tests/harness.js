// Loads the real index.js (a classic browser script) inside Node with
// minimal fakes for Vue, DOM, Audio, Notification, ProgressBar and
// localStorage. The app's setup() return value is the test seam.
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../index.js", import.meta.url), "utf8");

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
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        style: {},
        disabled: false,
        value: undefined,
        querySelector: () => fakeEl(),
        querySelectorAll: () => []
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
        this.volume = 1;
        this.currentTime = 0;
        this.muted = false;
        this.paused = true;
        this.preload = "auto";
        FakeAudio.instances.push(this);
    }
    play() {
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
 * Boot the app. Returns the setup() API plus the fakes for assertions.
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.storage] pre-seeded localStorage
 * @param {object|null} [opts.notification] fake Notification (null = absent)
 */
export const createApp = ({
    storage = {},
    notification,
    reducedMotion = false
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
    }

    const playBtn = fakeEl();
    const panels = {
        "#settings-container .container": fakeEl(),
        "#todo-container .container": fakeEl(),
        "#main-container": fakeEl(),
        'meta[name="theme-color"]': fakeEl()
    };
    const document = {
        title: "",
        documentElement: fakeEl(),
        querySelector: (sel) => {
            if (sel === "#button-container > #play > div") {
                return playBtn;
            }
            return panels[sel] || fakeEl();
        },
        querySelectorAll: () => [],
        getElementsByClassName: () => []
    };
    const window = {
        addEventListener() {},
        focus() {},
        matchMedia: (query) => ({
            matches: reducedMotion && query.includes("prefers-reduced-motion")
        })
    };
    if (Notification) {
        window.Notification = Notification;
    }

    FakeAudio.instances = [];
    FakeAudio.played = [];
    const bar = new FakePath();

    const mounted = [];
    const watchers = [];
    let api;
    const Vue = {
        ref: (v) => ({ value: v }),
        computed: (fn) => ({
            get value() {
                return fn();
            }
        }),
        watch: (_src, cb) => watchers.push(cb),
        onMounted: (cb) => mounted.push(cb),
        nextTick: (cb) => {
            if (cb) {
                cb();
            }
            return Promise.resolve();
        },
        createApp: (opts) => ({
            mount() {
                api = opts.setup();
                mounted.forEach((cb) => cb());
            }
        })
    };

    new Function(
        "Vue",
        "document",
        "window",
        "Notification",
        "Audio",
        "Storage",
        "localStorage",
        "ProgressBar",
        source
    )(
        Vue,
        document,
        window,
        Notification,
        FakeAudio,
        function Storage() {},
        localStorage,
        {
            Path: function () {
                return bar;
            }
        }
    );

    // Vue would have rendered playState into the DOM before the next click.
    const pressPlay = () => {
        playBtn.classes.clear();
        playBtn.classList.add(api.playState.value ? "play" : "pause");
        api.playFunc();
    };

    return {
        api,
        document,
        panels,
        localStorage,
        bar,
        audios: FakeAudio,
        pressPlay,
        flushWatchers: () => watchers.forEach((cb) => cb())
    };
};

export const tickSeconds = (t, n) => {
    for (let i = 0; i < n; i++) {
        t.mock.timers.tick(1000);
    }
};
