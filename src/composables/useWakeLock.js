// Keep the screen on while a round is running (phones in particular).
export const useWakeLock = ({
    navigator: nav = globalThis.navigator,
    document: doc = globalThis.document
} = {}) => {
    let sentinel = null;
    let wanted = false;

    const acquire = async () => {
        wanted = true;
        if (!nav?.wakeLock || sentinel) {
            return;
        }
        try {
            sentinel = await nav.wakeLock.request("screen");
            sentinel.addEventListener("release", () => {
                sentinel = null;
            });
        } catch (_error) {
            sentinel = null; // denied (battery saver, hidden tab): fine
        }
    };
    const release = () => {
        wanted = false;
        sentinel?.release();
        sentinel = null;
    };
    doc?.addEventListener?.("visibilitychange", () => {
        if (doc.visibilityState === "visible" && wanted) {
            acquire();
        }
    });

    return { acquire, release };
};
