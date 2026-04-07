import express from 'express';
import cors from 'cors';
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { HttpError } from './helpers/error.js';
import { sendSuccess } from './helpers/response.js';
import { errorMiddleware } from './middleware/error.js';
import { BackgroundTask } from './background/background-task.js';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

const taskList = ['foo-task'];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', auth);
app.use('/events', events);

/**
 * Serves the readiness probe used by local and container health checks.
 */
app.get('/ready', (req, res) => {
    sendSuccess(res, {
        status: 200,
        data: { ready: true },
        message: 'I am ready!',
    });
});

/**
 * Forwards unmatched API requests to the terminal error middleware.
 */
app.use((req, res, next) => {
    next(new HttpError(404, 'I am sorry, but I think you are lost.'));
});

app.use(errorMiddleware);

/**
 * Boots background tasks registered in the `taskList` object, which maps a task name to its file name in the `background` folder. Each task module is expected to export a `BackgroundTask` instance with the same name as the task.
 */
taskList.forEach(async (file) => {
    const { task } = await import(`./background/${file}.js`);
    if (!(task instanceof BackgroundTask)) {
        console.warn(`Task "${file}" does not export a BackgroundTask instance named "task". Skipping.`);
        return;
    }
    task.start();
});

/**
 * Starts the API server outside of test environments.
 */
async function start() {
    try {
        if (process.env.NODE_ENV !== 'test') {
            app.listen(port, host, () => {
                console.log(`Academic Events API running on http://${host}:${port}`);
            });
        }
    } catch (err) {
        console.error('Não foi possível inicializar o banco de dados MySQL.', err);
        process.exit(1);
    }
}

start();

export { app, start };
