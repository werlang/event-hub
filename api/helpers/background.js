import { BackgroundTask } from '../background/background-task.js';

/**
 * Loads one background task module from the background directory.
 */
async function loadBackgroundTaskModule(file) {
    return import(`../background/${file}.js`);
}

/**
 * Boots the configured background tasks and starts each valid `BackgroundTask` instance.
 */
export async function startBackgroundTasks(taskFiles, taskLoader = loadBackgroundTaskModule) {
    const startedTasks = [];

    for (const file of taskFiles) {
        const { task } = await taskLoader(file);

        if (!(task instanceof BackgroundTask)) {
            console.warn(`Task "${file}" does not export a BackgroundTask instance named "task". Skipping.`);
            continue;
        }

        task.start();
        startedTasks.push(task);
    }

    return startedTasks;
}