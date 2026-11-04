import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import "./styles/main.scss";

createApp(App).mount("#app");

if ("serviceWorker" in navigator) {
    registerSW({ immediate: true, onRegisterError() {} });
}
