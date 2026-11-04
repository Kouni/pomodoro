import { computed, ref } from "vue";

const TAB_OFFSETS = {
    time: ["0", "0"],
    audio: ["84px", "-100%"],
    add: ["168px", "-200%"]
};

// Side panels and the settings tab strip. Closed panels are inert in the
// template so keyboard focus cannot reach them.
export const useUi = () => {
    const settingsOpen = ref(false);
    const todoOpen = ref(false);
    const activeTab = ref("time");
    const tabStyle = computed(() => ({
        hr: { marginLeft: TAB_OFFSETS[activeTab.value][0] },
        page: { marginLeft: TAB_OFFSETS[activeTab.value][1] }
    }));
    const openTab = (elem) => {
        if (elem === "settings") {
            settingsOpen.value = true;
        } else {
            todoOpen.value = true;
        }
    };
    const removeOverlay = (elem) => {
        if (elem === "settings") {
            settingsOpen.value = false;
        } else {
            todoOpen.value = false;
        }
    };
    const settingsTabs = (tab) => {
        activeTab.value = tab;
    };
    return {
        settingsOpen,
        todoOpen,
        activeTab,
        tabStyle,
        openTab,
        removeOverlay,
        settingsTabs
    };
};
