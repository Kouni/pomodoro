export const MAX_TASKS = 8;
export const ROUND_NAMES = [
    "Focus on work",
    "Take a short break",
    "Take a long break"
];
export const ROUND_NAMES_SHORT = ["Work", "Short break", "Long break"];

// Seconds in a timer "minute". Only a local dev server may shorten it
// (index.html?minute=3 makes a one-minute round last 3 s) so tests that
// need real timers finish in seconds; the deployed site always uses 60.
export const minuteSeconds = ({ hostname = "", search = "" } = {}) => {
    const local = /^(localhost|127\.0\.0\.1)$/.test(hostname);
    const override = Number(new URLSearchParams(search).get("minute"));
    return local && override > 0 ? override : 60;
};

export const timerFormat = (value) =>
    value.toString().length === 1 ? "0" + value : value;

const formatTimeForTitle = (minutes, seconds) => {
    if (minutes > 99) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${timerFormat(hours)}:${timerFormat(mins)}:${timerFormat(seconds)}`;
    }
    return `${timerFormat(minutes)}:${timerFormat(seconds)}`;
};

export const pageTitle = (minutes, seconds, isWork, isCountdown, isPaused) => {
    if (isPaused && isCountdown) {
        return `${isWork ? "🔥" : "😴"} ⏸️ Paused - Pomodoro Timer`;
    }
    if (isCountdown) {
        return `${isWork ? "🔥" : "😴"} ${formatTimeForTitle(minutes, seconds)} - Pomodoro Timer`;
    }
    return "Pomodoro Timer";
};

export const nowSeconds = () => Math.trunc(Date.now() / 1000);
