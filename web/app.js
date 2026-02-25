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
}));

app.get('/', (req, res) => {
    res.templateRender('index', { page: 'home' });
});

app.get('/login', (req, res) => {
    res.templateRender('login', { page: 'login', redirect: req.query.redirect || '' });
});

app.get('/publish', (req, res) => {
    res.templateRender('publish', { page: 'publish', redirect: req.query.redirect || '' });
});

// static assets
app.use(express.static(new URL('../public/', import.meta.url).pathname));

// 404
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, host, () => {
    console.log(`Academic Events Web running on http://${host}:${port}`);
});

export { app };
