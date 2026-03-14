import express from 'express';
import mustacheExpress from 'mustache-express';
import { renderMiddleware } from './middleware/render.js';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', new URL('./src/html/', import.meta.url).pathname);

// render middleware, setting some variables to be used in all views
app.use(renderMiddleware({
    apiUrl: process.env.API_URL,
    year: new Date().getFullYear(),
}));

/**
 * Renders the public home page shell.
 */
app.get('/', (req, res) => {
    res.templateRender('index', {
        page: 'home',
        weekStart: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).toISOString().split('T')[0],
        weekEnd: new Date(new Date().setDate(new Date().getDate() + (6 - new Date().getDay()))).toISOString().split('T')[0],
    });
});

/**
 * Renders the login page while preserving any redirect target.
 */
app.get('/login', (req, res) => {
    res.templateRender('login', { page: 'login', redirect: req.query.redirect || '' });
});

/**
 * Renders the dashboard shell used for authenticated tooling.
 */
app.get('/dashboard', (req, res) => {
    res.templateRender('dashboard', { page: 'dashboard' });
});

// static assets
app.use(express.static(new URL('./public/', import.meta.url).pathname));

/**
 * Returns a plain-text 404 for unmatched web routes.
 */
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, host, () => {
    console.log(`Academic Events Web running on http://${host}:${port}`);
});

export { app };
