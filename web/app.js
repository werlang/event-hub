import express from 'express';
import mustacheExpress from 'mustache-express';
import { renderMiddleware } from './middleware/render.js';
import { getCurrentWeekRangeLocal } from './src/js/helpers/week-range.js';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

/**
 * Formats one YYYY-MM-DD value for public week-page copy.
 */
function formatCalendarDatePtBr(value) {
    const [yearText, monthText, dayText] = String(value || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return '';
    }

    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(year, month - 1, day));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', new URL('./src/html/', import.meta.url).pathname);

const SITE_NAME = 'Agenda Acadêmica – IFSul Campus Charqueadas';
const DEFAULT_DESCRIPTION = 'Acompanhe os eventos acadêmicos do Campus Charqueadas do Instituto Federal Sul-Rio-Grandense.';
const DEFAULT_KEYWORDS = 'agenda acadêmica, eventos, ifsul, campus charqueadas, instituto federal, sul-rio-grandense, palestras, oficinas, simpósios';
const webUrl = (process.env.WEB_URL || '').replace(/\/$/, '');

// render middleware, setting some variables to be used in all views
app.use(renderMiddleware({
    apiUrl: process.env.API_URL,
    webUrl,
    year: new Date().getFullYear(),
    metaTitle: SITE_NAME,
    metaDescription: DEFAULT_DESCRIPTION,
    metaKeywords: DEFAULT_KEYWORDS,
    siteName: SITE_NAME,
}));

/**
 * Renders the public home page shell.
 */
app.get('/', (req, res) => {
    res.templateRender('index', {
        metaRobots: 'index, follow',
        canonicalPath: '/',
    });
});

/**
 * Renders the login page while preserving any redirect target.
 */
app.get('/login', (req, res) => {
    res.templateRender('login', {
        page: 'login',
        redirect: req.query.redirect || '',
        metaTitle: `Entrar · ${SITE_NAME}`,
        metaDescription: 'Acesse sua conta para publicar e gerenciar eventos acadêmicos no Campus Charqueadas.',
        metaRobots: 'noindex, nofollow',
        canonicalPath: '/login',
    });
});

/**
 * Renders the public page listing approved events scheduled for the current week.
 */
app.get('/week', (req, res) => {
    const weekRange = getCurrentWeekRangeLocal();
    res.templateRender('week', {
        weekFrom: weekRange.from,
        weekTo: weekRange.to,
        weekRangeLabel: `${formatCalendarDatePtBr(weekRange.from)} a ${formatCalendarDatePtBr(weekRange.to)}`,
        weekCalendarJoinUrl: process.env.GOOGLE_CALENDAR_JOIN_URL,
        metaTitle: `Agenda da Semana · ${SITE_NAME}`,
        metaDescription: 'Confira os eventos acadêmicos aprovados para esta semana no Campus Charqueadas do IFSul.',
        metaRobots: 'index, follow',
        canonicalPath: '/week',
    });
});

/**
 * Renders the dashboard shell used for authenticated tooling.
 */
app.get('/dashboard', (req, res) => {
    res.templateRender('dashboard', {
        page: 'dashboard',
        metaTitle: `Painel · ${SITE_NAME}`,
        metaRobots: 'noindex, nofollow',
        canonicalPath: '/dashboard',
    });
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
