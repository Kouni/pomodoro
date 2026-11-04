import { ref } from "vue";

const CUES = {
    finish: ["Pomodoro Session Complete!", "All rounds completed. Great job!"],
    breakStart: ["Break Time!", "Time to take a well-deserved break."],
    workStart: ["Work Time!", "Break's over. Time to focus and get productive!"]
};

export const useNotifications = ({
    settings,
    Notification = globalThis.Notification,
    serviceWorker = globalThis.navigator?.serviceWorker,
    focus = () => globalThis.focus?.()
}) => {
    const permission = ref(Notification ? Notification.permission : "denied");

    const requestPermission = async () => {
        if (!Notification) {
            return false;
        }
        if (Notification.permission === "granted") {
            permission.value = "granted";
            return true;
        }
        if (Notification.permission === "denied") {
            return false;
        }
        try {
            permission.value = await Notification.requestPermission();
            return permission.value === "granted";
        } catch (_error) {
            return false;
        }
    };

    const handleToggle = async () => {
        if (
            settings.enableNotifications.value &&
            !(await requestPermission())
        ) {
            settings.enableNotifications.value = false;
        }
    };

    // Prefer the service worker: Android Chrome rejects new Notification().
    const show = async (title, body) => {
        const options = {
            body,
            icon: "/icons/favicon-32x32.png",
            tag: "pomodoro-timer",
            silent: false
        };
        try {
            const registration = await serviceWorker?.getRegistration?.();
            if (registration?.showNotification) {
                await registration.showNotification(title, options);
                return;
            }
            const notification = new Notification(title, options);
            notification.onclick = () => {
                focus();
                notification.close();
            };
            setTimeout(() => notification.close(), 8000);
        } catch (_error) {
            // Notifications are best effort.
        }
    };

    const notifyCue = (fx) => {
        if (
            !settings.enableNotifications.value ||
            permission.value !== "granted" ||
            !CUES[fx]
        ) {
            return;
        }
        show(...CUES[fx]);
    };

    return { permission, requestPermission, handleToggle, notifyCue, show };
};
