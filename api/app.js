import express from 'express';
import cors from 'cors';
import { router as auth } from './routes/auth.js';
import { router as events } from './routes/events.js';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', auth);
app.use('/events', events);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, host, () => {
    console.log(`Academic Events API running on http://${host}:${port}`);
});

export { app };
