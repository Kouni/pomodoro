import { ref, watch } from "vue";
import {
    DEFAULT_SETTINGS,
    hasSavedSettings,
    loadSettings,
    saveSettings
} from "../lib/storage.js";

// One ref per setting, persisted to localStorage on every change.
export const useSettings = ({ storage }) => {
    const restored = hasSavedSettings(storage);
    const initial = restored ? loadSettings(storage) : { ...DEFAULT_SETTINGS };
    const keys = Object.keys(DEFAULT_SETTINGS);
    const refs = Object.fromEntries(
        keys.map((key) => [key, ref(initial[key])])
    );
    const save = () =>
        saveSettings(
            storage,
            Object.fromEntries(keys.map((key) => [key, refs[key].value]))
        );
    if (!restored) {
        save();
    }
    watch(Object.values(refs), save);
    return { ...refs, restored, save };
};
