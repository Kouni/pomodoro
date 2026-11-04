// One tick per second while a round runs. The page interval is the primary
// source; a dedicated worker (throttled less in hidden tabs) and the
// visibilitychange event add ticks, which is safe because every tick
// recomputes from the wall clock.
export const useTicker = ({
    onTick,
    createWorker = () =>
        new Worker(new URL("../workers/ticker.js", import.meta.url), {
            type: "module"
        }),
    document: doc = globalThis.document
}) => {
    let interval = null;
    let worker = null;
    const running = () => interval !== null;

    const stop = () => {
        if (interval !== null) {
            clearInterval(interval);
            interval = null;
        }
        worker?.postMessage("stop");
    };
    const start = () => {
        stop();
        interval = setInterval(onTick, 1000);
        worker?.postMessage("start");
    };

    if (createWorker) {
        try {
            worker = createWorker();
            worker.onmessage = () => {
                if (running()) {
                    onTick();
                }
            };
        } catch (_error) {
            worker = null;
        }
    }
    doc?.addEventListener?.("visibilitychange", () => {
        if (doc.visibilityState === "visible" && running()) {
            onTick();
        }
    });

    return { start, stop, running };
};
