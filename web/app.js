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

/**
 * Builds the template variables used by the public current-week page.
 */
function createCurrentWeekViewModel(referenceDate = new Date()) {
    const weekRange = getCurrentWeekRangeLocal(referenceDate);

    return {
        weekFrom: weekRange.from,
        weekTo: weekRange.to,
        weekRangeLabel: `${formatCalendarDatePtBr(weekRange.from)} a ${formatCalendarDatePtBr(weekRange.to)}`,
    };
}

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
    res.templateRender('index');
});

/**
 * Renders the login page while preserving any redirect target.
 */
app.get('/login', (req, res) => {
    res.templateRender('login', { page: 'login', redirect: req.query.redirect || '' });
});

/**
 * Renders the public page listing approved events scheduled for the current week.
 */
app.get('/week', (req, res) => {
    res.templateRender('week', {
        ...createCurrentWeekViewModel(),
    });
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
