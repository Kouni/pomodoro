import { watch } from "vue";

// Theme bits outside the mounted template: page background class and the
// browser chrome colour. The app root binds .dark-theme itself.
export const useTheme = ({ darkMode, document: doc = globalThis.document }) => {
    watch(
        darkMode,
        (dark) => {
            doc.documentElement.classList.toggle("light-theme", !dark);
            const meta = doc.querySelector('meta[name="theme-color"]');
            if (meta) {
                meta.setAttribute("content", dark ? "#121212" : "#f43147");
            }
        },
        { immediate: true }
    );
};
