import { BackgroundTask } from '../background/background-task.js';

/**
 * Loads one background task module from the background directory.
 */
async function taskLoader(file) {
    if (!file || typeof file !== 'string') {
        return `Invalid task file "${file}". Skipping.`;
    }
    const { task } = await import(`../background/${file}.js`);
    if (!task || task.enabled === false) {
        return `Task "${file}" is disabled. Skipping.`;
    }
    if (!task?.rule || !task?.callback || !task?.name) {
        return `Task "${file}" does not export a valid BackgroundTask configuration. Skipping.`;
    }

    return new BackgroundTask(task.rule, task.callback, { name: task.name });
}

/**
 * Boots the configured background tasks and starts each valid `BackgroundTask` instance.
 */
export async function startBackgroundTasks(tasks) {
    const startedTasks = [];

    for (const file of tasks) {
        const task = await taskLoader(file);

        if (typeof task === 'string') {
            console.warn(task);
            continue;
        }

        if (!(task instanceof BackgroundTask)) {
            console.warn(`Task "${file}" does not export a BackgroundTask instance named "task". Skipping.`);
            continue;
        }

        task.start();
        startedTasks.push(task);
    }

    return startedTasks;
}