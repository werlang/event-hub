import { BackgroundTask } from '../background/background-task.js';

/**
 * Loads one background task module from the background directory.
 */
async function taskLoader(file) {
    if (!file || typeof file !== 'string') {
        throw new Error(`Invalid task configuration: missing "file" property.`);
    }
    const { task } = await import(`../background/${file}.js`);
    if (!task?.rule || !task?.callback || !task?.name) {
        throw new Error(`Invalid task configuration: missing required properties: rule, callback, name.`);
    }

    return new BackgroundTask(task.rule, task.callback, { name: task.name });
}

/**
 * Boots the configured background tasks and starts each valid `BackgroundTask` instance.
 */
export async function startBackgroundTasks(tasks) {
    const startedTasks = [];

    for (const task of tasks) {
        const loadedTask = await taskLoader(task);
        if (loadedTask?.enabled === false) {
            console.info(`Task "${task.file}" is disabled. Skipping.`);
            continue;
        }

        if (!(loadedTask instanceof BackgroundTask)) {
            console.warn(`Task "${task.file}" does not export a BackgroundTask instance named "task". Skipping.`);
            continue;
        }

        loadedTask.start();
        startedTasks.push(loadedTask);
    }

    return startedTasks;
}