// Dedicated-worker timers are throttled less than page timers in hidden
// tabs, so this supplements the page's own setInterval while a round runs.
let interval = null;

self.onmessage = ({ data }) => {
    if (data === "start" && interval === null) {
        interval = setInterval(() => self.postMessage("tick"), 1000);
    } else if (data === "stop" && interval !== null) {
        clearInterval(interval);
        interval = null;
    }
};
