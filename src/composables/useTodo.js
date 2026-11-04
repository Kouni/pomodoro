import { ref, watch } from "vue";
import { loadTasks, saveTasks, TASKS_PLACEHOLDER } from "../lib/storage.js";
import { MAX_TASKS } from "../lib/time.js";

export const useTodo = ({ storage, onChange = () => {} }) => {
    const loaded = loadTasks(storage);
    const newTask = ref(loaded.newTask);
    const tasks = ref(loaded.tasks);
    const tasksFull = ref(false);
    const removingId = ref(null);

    // Stable ids for v-for keys; older saves have none.
    let taskSeq = Math.max(
        0,
        ...tasks.value.map((task) => task.id).filter(Number.isInteger)
    );
    const nextTaskId = () => ++taskSeq;
    tasks.value.forEach((task) => {
        if (!Number.isInteger(task.id)) {
            task.id = nextTaskId();
        }
    });

    const save = () =>
        saveTasks(storage, { newTask: newTask.value, tasks: tasks.value });
    if (storage.getItem("tasks") === null) {
        save();
    }
    watch([newTask, tasks], save, { deep: true });

    const addTask = () => {
        if (newTask.value.length <= 0) {
            return;
        }
        if (tasks.value.length >= MAX_TASKS) {
            tasksFull.value = true;
            newTask.value = TASKS_PLACEHOLDER;
            setTimeout(() => {
                if (newTask.value === TASKS_PLACEHOLDER) {
                    newTask.value = "";
                }
                tasksFull.value = false;
            }, 3000);
            return;
        }
        let isPriority = false;
        if (newTask.value[0] === "!") {
            newTask.value = newTask.value.substr(1);
            isPriority = true;
        }
        newTask.value = newTask.value.trim().replace(/\s+/g, " ");
        if (newTask.value.length > 0) {
            newTask.value =
                newTask.value.charAt(0).toUpperCase() + newTask.value.slice(1);
        }
        if (newTask.value.length <= 0) {
            return;
        }
        tasks.value.push({
            id: nextTaskId(),
            text: newTask.value,
            completed: false,
            priority: isPriority
        });
        newTask.value = "";
        onChange();
    };

    const removeTask = (index) => {
        const { id } = tasks.value[index];
        removingId.value = id; // drives the exit animation class
        setTimeout(() => {
            const i = tasks.value.findIndex((task) => task.id === id);
            if (i !== -1) {
                tasks.value.splice(i, 1);
            }
            removingId.value = null;
        }, 500);
        onChange();
    };

    const completeTask = (index) => {
        if (index >= tasks.value.length) {
            return;
        }
        tasks.value[index].completed = !tasks.value[index].completed;
    };

    return {
        newTask,
        tasks,
        tasksFull,
        removingId,
        addTask,
        removeTask,
        completeTask
    };
};
