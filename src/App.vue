<script>
import { nextTick, onMounted, ref } from "vue";
import ProgressBar from "progressbar.js";
import { ROUND_NAMES, minuteSeconds, timerFormat } from "./lib/time.js";
import { useSettings } from "./composables/useSettings.js";
import { useTodo } from "./composables/useTodo.js";
import { useAudio } from "./composables/useAudio.js";
import { useNotifications } from "./composables/useNotifications.js";
import { useTicker } from "./composables/useTicker.js";
import { useWakeLock } from "./composables/useWakeLock.js";
import { useTheme } from "./composables/useTheme.js";
import { useUi } from "./composables/useUi.js";
import { useTimer } from "./composables/useTimer.js";

export default {
    name: "App",
    setup() {
        const storage = window.localStorage;
        const settings = useSettings({ storage });
        const todo = useTodo({
            storage,
            onChange: () => updateTodoContainerHeight()
        });
        const notifications = useNotifications({ settings });
        // audio and the ticker need timer state; the closures resolve lazily.
        // eslint-disable-next-line prefer-const -- assigned after its users
        let timer;
        const audio = useAudio({
            settings,
            isWork: () => timer.roundName.value === ROUND_NAMES[0],
            running: () => timer.isCountdown.value,
            notify: (fx) => notifications.notifyCue(fx)
        });
        const ticker = useTicker({ onTick: () => timer.tick() });
        const wakeLock = useWakeLock();
        const bar = ref(null);
        timer = useTimer({
            settings,
            todo,
            audio,
            notifications,
            ticker,
            wakeLock,
            bar: () => bar.value,
            setTitle: (title) => {
                document.title = title;
            },
            minute: minuteSeconds(window.location),
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        });
        useTheme({ darkMode: settings.darkMode });

        const ui = useUi();

        // The todo panel switches to a scrolling layout on short viewports.
        const checkTodoHeight = () => {
            const n = todo.tasks.value.length;
            if (n === 0) {
                return 141;
            }
            return n === 1 ? 170 : 170 + (n - 1) * 65;
        };
        const updateTodoContainerHeight = () => {
            const container = document.querySelector(
                "#todo-container .container"
            );
            const taskContainer = document.querySelector(
                "#todo-container .container #task-container"
            );
            if (!container || !taskContainer) {
                return;
            }
            if (
                window.matchMedia(`(max-height: ${checkTodoHeight()}px)`)
                    .matches
            ) {
                container.style.top = "20px";
                container.style.transform = "translateY(0)";
                container.style.height = "calc(100% - 40px)";
                taskContainer.style.overflowY = "scroll";
                taskContainer.style.overflowX = "hidden";
                taskContainer.style.height = "calc(100% - 50px)";
            } else {
                container.style.top = "50%";
                container.style.transform = "translateY(-50%)";
                container.style.height = "auto";
                taskContainer.style.overflow = "hidden";
                taskContainer.style.height = "auto";
            }
        };

        const resetDefault = (setting) => {
            if (setting === "time") {
                settings.roundRange.value = 4;
                settings.workRange.value = 25;
                settings.sBreakRange.value = 5;
                settings.lBreakRange.value = 15;
                timer.changeCountdown();
                timer.changeRound();
            } else if (setting === "audio") {
                settings.isMusic.value = false;
                settings.soundVolume.value = 100;
                settings.musicVolume.value = 75;
                settings.musicTiming.value = "work";
                audio.musicOn("");
                settings.musicPref.value = "nature";
            } else {
                settings.autoPomodoro.value = true;
                settings.autoBreak.value = true;
                settings.autoTodoEmpty.value = false;
                settings.infinite.value = false;
                settings.musicTiming.value = "work";
                settings.darkMode.value = true;
                settings.enableNotifications.value = true;
            }
        };

        onMounted(() => {
            bar.value = new ProgressBar.Path("#timer-path");
            bar.value.set(1);
            nextTick(() => audio.musicState());
            updateTodoContainerHeight();
            window.addEventListener("resize", updateTodoContainerHeight);
        });

        return {
            ...settings,
            ...todo,
            ...audio,
            ...timer,
            notificationPermission: notifications.permission,
            handleNotificationToggle: notifications.handleToggle,
            ...ui,
            resetDefault,
            timerFormat
        };
    }
};
</script>

<template>
    <div id="main-container" :class="{ 'dark-theme': darkMode }">
        <div role="main">
            <div id="button-icons">
                <button id="settings" @click="openTab('settings')">
                    <img src="/icons/icon_settings.svg" alt="Settings Icon" />
                </button>
                <button id="todo" @click="openTab('todo')">
                    <img src="/icons/icon_todo.svg" alt="To do list Icon" />
                </button>
            </div>
            <div class="title">
                <h1 v-if="!isCountdown">Pomodoro Timer</h1>
                <p v-if="!isCountdown">
                    Stop wasting time and get a top-notch productivity booster!
                </p>
                <div>
                    <h2 v-if="isCountdown">{{ roundName }}</h2>
                    <h2 class="short" v-if="isCountdown">
                        {{ shortRoundName }}
                    </h2>
                </div>
            </div>

            <div id="timer-container">
                <div id="svg-container">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        version="1.1"
                        x="0px"
                        y="0px"
                        viewBox="688.512 371.487 207.031 189.013"
                    >
                        <path
                            fill-opacity="0"
                            stroke-width="5"
                            stroke="#FFFFFF"
                            stroke-opacity="0.2"
                            stroke-linecap="round"
                            d=" M 732 556 C 661 506.5 690.25 374.5 793.125 376 C 896 377.5 921.5 504 852 556"
                        />
                        <path
                            id="timer-path"
                            fill-opacity="0"
                            stroke-width="5"
                            stroke="#FFFFFF"
                            stroke-linecap="round"
                            d=" M 732 556 C 661 506.5 690.25 374.5 793.125 376 C 896 377.5 921.5 504 852 556"
                        />
                    </svg>

                    <h2>
                        {{ timerFormat(minutes)
                        }}<small>:{{ timerFormat(seconds) }}</small>
                    </h2>
                    <p class="waiting" v-if="waitingReason" role="status">
                        {{ waitingReason }}
                    </p>
                </div>
                <div id="rounds-container" v-show="!infinite">
                    <ul>
                        <li
                            v-for="i in parseInt(roundRange)"
                            :key="i"
                            :class="dotClass(i)"
                        >
                            •
                        </li>
                    </ul>
                </div>

                <div id="button-container">
                    <button
                        id="restart"
                        class="button timer-button anim"
                        @click="resetTimer"
                    >
                        <img
                            src="/icons/button_restart.svg"
                            alt="Restart Icon"
                        />
                    </button>
                    <button
                        id="play"
                        class="button timer-button anim"
                        :aria-label="playState ? 'Start timer' : 'Pause timer'"
                        @click="playFunc"
                    >
                        <div
                            v-bind:class="{
                                play: playState,
                                pause: !playState
                            }"
                        ></div>
                    </button>
                    <button
                        class="button timer-button anim"
                        @click="fastForwardTimer"
                    >
                        <img
                            src="/icons/button_fast_forward.svg"
                            alt="Fast Forward Icon"
                        />
                    </button>
                </div>
            </div>
        </div>

        <div id="settings-container" role="complementary" aria-label="Settings">
            <div
                class="overlay"
                :class="{ opacBg: settingsOpen }"
                @click="removeOverlay('settings')"
            ></div>

            <div
                class="container"
                :class="{ open: settingsOpen }"
                :inert="!settingsOpen"
            >
                <nav>
                    <div
                        class="tabs"
                        role="tablist"
                        aria-label="Settings sections"
                    >
                        <button
                            type="button"
                            role="tab"
                            :aria-selected="activeTab === 'time'"
                            @click="settingsTabs('time')"
                        >
                            <img
                                src="/icons/settings_hourglass.svg"
                                alt="Time settings"
                            />
                        </button>
                        <button
                            type="button"
                            role="tab"
                            :aria-selected="activeTab === 'audio'"
                            @click="settingsTabs('audio')"
                        >
                            <img
                                src="/icons/settings_volume.svg"
                                alt="Audio settings"
                            />
                        </button>
                        <button
                            type="button"
                            role="tab"
                            :aria-selected="activeTab === 'add'"
                            @click="settingsTabs('add')"
                        >
                            <img
                                src="/icons/settings_plus.svg"
                                alt="More settings"
                            />
                        </button>
                        <hr role="presentation" :style="tabStyle.hr" />
                    </div>
                </nav>

                <div id="page-container" :style="tabStyle.page">
                    <div id="time-page">
                        <p>Work</p>
                        <span>{{ timerFormat(workRange) }}:00</span><br />
                        <input
                            class="slider"
                            type="range"
                            min="1"
                            max="60"
                            value="25"
                            aria-label="Work minutes"
                            v-model="workRange"
                            @input="changeCountdown"
                        />

                        <p>Short Break</p>
                        <span>{{ timerFormat(sBreakRange) }}:00</span><br />
                        <input
                            class="slider"
                            type="range"
                            min="1"
                            max="10"
                            value="5"
                            aria-label="Short break minutes"
                            v-model="sBreakRange"
                        />

                        <p>Long Break</p>
                        <span>{{ timerFormat(lBreakRange) }}:00</span><br />
                        <input
                            class="slider"
                            type="range"
                            min="1"
                            max="45"
                            value="15"
                            aria-label="Long break minutes"
                            v-model="lBreakRange"
                        />

                        <p>Rounds</p>
                        <span>{{ roundRange }}</span
                        ><br />
                        <input
                            class="slider"
                            type="range"
                            min="1"
                            max="10"
                            value="4"
                            aria-label="Rounds"
                            v-model="roundRange"
                            @input="changeRound"
                        /><br />

                        <button
                            class="default underline"
                            @click="resetDefault('time')"
                        >
                            Reset to Default
                        </button>
                    </div>

                    <div id="audio_page">
                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Music:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Music"
                                v-model="isMusic"
                                @change="musicState"
                            />
                        </div>

                        <p>Notification Volume</p>
                        <span>{{ soundVolume }}%</span><br />
                        <input
                            class="slider"
                            type="range"
                            min="0"
                            max="100"
                            value="100"
                            aria-label="Notification volume"
                            v-model="soundVolume"
                        />

                        <p>Music Volume</p>
                        <span>{{ musicVolume }}%</span><br />
                        <input
                            id="music-slider"
                            class="slider"
                            :class="{ disabled: !isMusic }"
                            :disabled="!isMusic"
                            type="range"
                            min="0"
                            max="100"
                            value="75"
                            aria-label="Music volume"
                            v-model="musicVolume"
                            @input="changeVolume"
                        />

                        <div
                            id="music_container"
                            style="margin: 15px auto 0; width: 100%"
                        >
                            <button
                                :class="{ disabled: !isMusic }"
                                :disabled="!isMusic"
                                @click="musicOn('nature')"
                                style="
                                    width: 22%;
                                    margin: 0 1%;
                                    font-size: 12px;
                                    height: 35px;
                                "
                            >
                                Nature
                            </button>
                            <button
                                :class="{ disabled: !isMusic }"
                                :disabled="!isMusic"
                                @click="musicOn('rain')"
                                style="
                                    width: 22%;
                                    margin: 0 1%;
                                    font-size: 12px;
                                    height: 35px;
                                "
                            >
                                Rain
                            </button>
                            <button
                                :class="{ disabled: !isMusic }"
                                :disabled="!isMusic"
                                @click="musicOn('cafe')"
                                style="
                                    width: 22%;
                                    margin: 0 1%;
                                    font-size: 12px;
                                    height: 35px;
                                "
                            >
                                Café
                            </button>
                            <button
                                :class="{ disabled: !isMusic }"
                                :disabled="!isMusic"
                                @click="musicOn('music')"
                                style="
                                    width: 22%;
                                    margin: 0 1%;
                                    font-size: 12px;
                                    height: 35px;
                                "
                            >
                                Music
                            </button>
                        </div>

                        <p style="margin: 15px auto 5px">Music Timing</p>
                        <select
                            id="music-timing"
                            :class="{ disabled: !isMusic }"
                            :disabled="!isMusic"
                            aria-label="Music timing"
                            v-model="musicTiming"
                        >
                            <option value="work">Only during work</option>
                            <option value="breaks">Only during breaks</option>
                            <option value="both">During work and breaks</option>
                        </select>

                        <button
                            class="default underline"
                            @click="resetDefault('audio')"
                            style="margin-top: 20px"
                        >
                            Reset to Default
                        </button>
                    </div>

                    <div id="add_page">
                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Dark Mode:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Dark mode"
                                v-model="darkMode"
                            />
                        </div>

                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Browser Notifications:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Browser notifications"
                                v-model="enableNotifications"
                                @change="handleNotificationToggle"
                            />
                        </div>

                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Auto-start pomodoros:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Auto-start pomodoros"
                                v-model="autoPomodoro"
                            />
                        </div>

                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Auto-start breaks:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Auto-start breaks"
                                v-model="autoBreak"
                            />
                        </div>

                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Don't start auto-pomodoro<br />if To Do List is
                                empty:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Don't start auto-pomodoro if to-do list is empty"
                                v-model="autoTodoEmpty"
                            />
                        </div>

                        <div class="toggle-container">
                            <p
                                style="
                                    display: inline-block;
                                    vertical-align: middle;
                                "
                            >
                                Infinite:
                            </p>
                            <input
                                class="toggle"
                                type="checkbox"
                                aria-label="Infinite"
                                v-model="infinite"
                                @change="changeInfinite"
                            />
                        </div>

                        <button
                            class="default underline"
                            @click="resetDefault('add')"
                        >
                            Reset to Default
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div id="todo-container" role="complementary" aria-label="To-do list">
            <div
                class="overlay"
                :class="{ opacBg: todoOpen }"
                @click="removeOverlay('todo')"
            ></div>

            <div
                class="container"
                :class="{ open: todoOpen }"
                :inert="!todoOpen"
            >
                <p v-if="Object.keys(tasks).length === 0">
                    You have no tasks to complete
                </p>

                <div id="task-container">
                    <div
                        class="task"
                        v-for="(task, index) in tasks"
                        :key="task.id"
                        :class="{ remove: task.id === removingId }"
                    >
                        <div
                            class="tick-container"
                            :class="{ 'tick-complete': task.completed }"
                            role="button"
                            tabindex="0"
                            :aria-pressed="task.completed"
                            :aria-label="'Complete ' + task.text"
                            @click="completeTask(index)"
                            @keydown.enter.prevent="completeTask(index)"
                            @keydown.space.prevent="completeTask(index)"
                        >
                            <div
                                class="tick"
                                :class="{ draw: task.completed }"
                            ></div>
                        </div>
                        <span
                            :class="{
                                priority: task.priority,
                                completed: task.completed
                            }"
                            >{{ task.text }}</span
                        >
                        <span
                            class="complete"
                            :class="{
                                priority: task.priority,
                                completed: task.completed
                            }"
                            >{{ task.text }}</span
                        >
                        <button
                            :class="{ remove: task.id === removingId }"
                            :aria-label="'Remove ' + task.text"
                            @click="removeTask(index)"
                        >
                            &#10006;
                        </button>
                    </div>
                </div>

                <div id="add-task-container">
                    <textarea
                        placeholder="Add your tasks here..."
                        rows="1"
                        maxlength="50"
                        spellcheck="false"
                        aria-label="New task"
                        :disabled="tasksFull"
                        :class="{ alert: tasksFull }"
                        v-model="newTask"
                        @keydown.enter.prevent="addTask"
                    ></textarea>
                    <button id="add-task" class="button anim" @click="addTask">
                        +
                    </button>
                    <!--<span>{{ 50 - newTask.length }}</span>-->
                </div>
            </div>
        </div>
    </div>
</template>
