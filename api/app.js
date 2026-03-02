import express from 'express';
import cors from 'cors';
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';
import { CustomError } from './helpers/error.js';
import { sendSuccess } from './helpers/response.js';
import { errorMiddleware } from './middleware/error.js';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', auth);
app.use('/events', events);

app.get('/ready', (req, res) => {
    sendSuccess(res, {
        status: 200,
        data: { ready: true },
        message: 'I am ready!',
    });
});

app.use((req, res, next) => {
    next(new CustomError(404, 'I am sorry, but I think you are lost.'));
});

app.use(errorMiddleware);

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

export { app };
