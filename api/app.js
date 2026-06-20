import express from 'express';
import cors from 'cors';
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { router as users } from './routes/users.js';
import { HttpError } from './helpers/error.js';
import { sendSuccess } from './helpers/response.js';
import { errorMiddleware } from './middleware/error.js';
import { startBackgroundTasks } from './helpers/background-task-loader.js';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

const BACKGROUND_TASK_FILES = ['weekly-digest-task', 'database-backup-task'];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', auth);
app.use('/events', events);
app.use('/users', users);

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
 * Starts the API server outside of test environments.
 */
async function start() {
    try {
        if (process.env.NODE_ENV !== 'test') {
            app.listen(port, host, () => {
                console.log(`Academic Events API running on http://${host}:${port}`);
            });
            await startBackgroundTasks(BACKGROUND_TASK_FILES);
        }
    } catch (err) {
        console.error('Failed to start the server:', err);
        process.exit(1);
    }
}

start();

export { app, BACKGROUND_TASK_FILES, start, startBackgroundTasks };
