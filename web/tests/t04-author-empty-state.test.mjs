import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { Event } from '../src/js/helpers/event.js';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const HOME_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/index.js');
const EVENT_CARD_PATH = path.join(WEB_ROOT, 'src/js/components/event-card.js');
const DASHBOARD_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/dashboard.js');
const INDEX_BUNDLE_PATH = path.join(WEB_ROOT, 'public/js/index.min.js');
const DASHBOARD_BUNDLE_PATH = path.join(WEB_ROOT, 'public/js/dashboard.min.js');
const INDEX_CSS_BUNDLE_PATH = path.join(WEB_ROOT, 'public/css/index.min.css');
const DASHBOARD_CSS_BUNDLE_PATH = path.join(WEB_ROOT, 'public/css/dashboard.min.css');

/**
 * Removes ESM import declarations so the home entry can run inside a VM with mocks.
 */
function stripImports(source) {
    const strippedLines = [];
    const lines = String(source || '').split('\n');
    let skippingImport = false;

    for (const line of lines) {
        if (!skippingImport && line.startsWith('import ')) {
            skippingImport = !line.trimEnd().endsWith(';');
            continue;
        }

        if (skippingImport) {
            skippingImport = !line.trimEnd().endsWith(';');
            continue;
        }

        strippedLines.push(line);
    }

    return strippedLines.join('\n');
}

/**
 * Rewrites the home entry source into a callable script with exported test hooks.
 */
function transformHomeEntrypointSource(source) {
    return stripImports(source)
        .replace('export function initHomePage() {', 'function initHomePage() {')
        .replace('\nnew Header();\n', '\n')
        .replace(/\ninitHomePage\(\);\s*$/, '\n')
        .concat('\nglobalThis.__t04 = { initHomePage };\n');
}

/**
 * Waits for the async work scheduled by initHomePage to settle.
 */
async function flushMicrotasks() {
    await Promise.resolve();
    await new Promise((resolve) => {
        setImmediate(resolve);
    });
}

/**
    * Converts VM-crossing values into plain JSON-compatible data for stable assertions.
    */
function normalizeValue(value) {
    return JSON.parse(JSON.stringify(value));
}

/**
 * Executes the home entrypoint inside a VM and captures how it drives its collaborators.
 */
async function runHomePageScenario(apiResponse) {
    const source = await readFile(HOME_ENTRY_PATH, 'utf8');
    const script = transformHomeEntrypointSource(source);
    const recorded = {
        clearCalls: [],
        renderCalls: [],
        requests: [],
        syncCalls: [],
        toastDismisses: [],
        toastShows: [],
        hydratedFilters: [],
        renderedChips: [],
    };
    const filters = {
        search: '',
        category: '',
        from: '2026-04-03',
        to: '2026-04-09',
    };
    const elementBySelector = new Map([
        ['#home-entry-surface', { hidden: false }],
        ['#home-filter-surface', { hidden: false }],
        ['#home-filter-tooltip', null],
        ['#filter-form', {}],
        ['#quick-chips', {}],
        ['#events-grid', {}],
        ['#events-empty', { hidden: true, textContent: 'Nenhum evento encontrado.' }],
        ['#filter-search', {}],
        ['#filter-category', {}],
        ['#filter-from', {}],
        ['#filter-to', {}],
    ]);

    const context = vm.createContext({
        URLSearchParams,
        console,
        window: {
            location: {
                search: '',
                pathname: '/',
            },
        },
        document: {
            querySelector(selector) {
                return elementBySelector.has(selector)
                    ? elementBySelector.get(selector)
                    : null;
            },
        },
        apiClient: {
            async request(endpoint) {
                recorded.requests.push(endpoint);
                return typeof apiResponse === 'function'
                    ? apiResponse(endpoint)
                    : apiResponse;
            },
        },
        Toast: {
            dismissGroup(group) {
                recorded.toastDismisses.push(group);
            },
            show(text, options = {}) {
                recorded.toastShows.push({ text, options });
                return { text, options };
            },
        },
        createHomeFilterParams(currentFilters) {
            return new URLSearchParams(currentFilters);
        },
        hasSpecificHomeQuery() {
            return false;
        },
        readHomeFiltersFromUrl() {
            return { ...filters };
        },
        EventList: class EventListMock {
            constructor() {
                this.ready = true;
            }

            isReady() {
                return this.ready;
            }

            clear(options) {
                recorded.clearCalls.push(options);
                return this;
            }

            render(events, options) {
                recorded.renderCalls.push({ events, options });
                return this;
            }
        },
        FilterForm: class FilterFormMock {
            isReady() {
                return true;
            }

            readFilters() {
                return { ...filters };
            }

            hydrate(nextFilters) {
                recorded.hydratedFilters.push(nextFilters);
            }

            bindApply(callback) {
                recorded.applyHandler = callback;
            }
        },
        QuickChips: class QuickChipsMock {
            isReady() {
                return true;
            }

            render(chips) {
                recorded.renderedChips = chips;
            }

            bindSelect(callback) {
                recorded.selectHandler = callback;
            }
        },
        Tooltip: class TooltipMock {},
        getCurrentWeekRangeLocal() {
            return { from: '2026-04-03', to: '2026-04-09' };
        },
        getNextDaysRangeLocal() {
            return { from: '2026-04-03', to: '2026-04-09' };
        },
        Header: class HeaderMock {},
    });

    vm.runInContext(script, context, { filename: HOME_ENTRY_PATH });
    context.__t04.initHomePage();
    await flushMicrotasks();

    return recorded;
}

test('Event.readAuthorText normalizes organizer names and preserves the shared fallback copy', () => {
    assert.equal(new Event({ organizerName: '  Maria Souza  ' }).readAuthorText(), 'Por Maria Souza');
    assert.equal(new Event({ organizerName: '   ' }).readAuthorText(), 'Por autoria não informada');
    assert.equal(new Event({}).readAuthorText(), 'Por autoria não informada');
});

test('Event.readTimelineMeta returns compact future and past labels', () => {
    const futureTimeline = new Event({ date: '2026-04-07T15:30:00' }).readTimelineMeta(new Date('2026-04-06T12:30:00'));
    const pastTimeline = new Event({ date: '2026-04-06T09:05:00' }).readTimelineMeta(new Date('2026-04-06T12:30:00'));

    assert.equal(futureTimeline.label, 'em 1d 3h');
    assert.equal(futureTimeline.tooltipLabel, 'Timeline: em 1d 3h');
    assert.equal(futureTimeline.icon, 'clock');
    assert.equal(futureTimeline.modifier, 'upcoming');

    assert.equal(pastTimeline.label, '3h 25m atrás');
    assert.equal(pastTimeline.tooltipLabel, 'Timeline: 3h 25m atrás');
    assert.equal(pastTimeline.icon, 'clock-rotate-left');
    assert.equal(pastTimeline.modifier, 'past');
});

test('home cards and dashboard moderation both call the shared Event class', async () => {
    const [eventCardSource, dashboardSource] = await Promise.all([
        readFile(EVENT_CARD_PATH, 'utf8'),
        readFile(DASHBOARD_ENTRY_PATH, 'utf8'),
    ]);

    assert.match(eventCardSource, /import\s+\{\s*Event\s*\}\s+from\s+'\.\.\/helpers\/event\.js';/);
    assert.match(eventCardSource, /author\.textContent\s*=\s*this\.#event\.readAuthorText\(\);/);
    assert.match(eventCardSource, /const timeline = event\.readTimelineMeta\(\);/);
    assert.match(dashboardSource, /import\s+\{\s*Event\s*\}\s+from\s+'\.\/helpers\/event\.js';/);
    assert.match(dashboardSource, /author\.textContent\s*=\s*eventRecord\.readAuthorText\(\);/);
    assert.match(dashboardSource, /const timelineMeta = eventRecord\.readTimelineMeta\(\);/);
});

test('home failures clear the grid without showing the inline empty state', async () => {
    const recorded = await runHomePageScenario({ ok: false, data: null });

    assert.deepEqual(recorded.requests, ['/events?search=&category=&from=2026-04-03&to=2026-04-09']);
    assert.deepEqual(normalizeValue(recorded.clearCalls), [{ showEmptyState: false }]);
    assert.deepEqual(recorded.renderCalls, []);
    assert.deepEqual(recorded.toastDismisses, ['home-status']);
    assert.deepEqual(normalizeValue(recorded.toastShows), [{
        text: 'Não foi possível carregar os eventos no momento.',
        options: {
            tone: 'error',
            group: 'home-status',
            duration: 6000,
        },
    }]);
});

test('home zero-result responses still use the inline empty state path', async () => {
    const recorded = await runHomePageScenario({
        ok: true,
        data: {
            events: [],
        },
    });

    assert.deepEqual(normalizeValue(recorded.clearCalls), [null]);
    assert.deepEqual(recorded.renderCalls, []);
    assert.deepEqual(normalizeValue(recorded.toastShows), [{
        text: 'Nenhum evento encontrado para os filtros aplicados.',
        options: {
            tone: 'info',
            group: 'home-status',
            duration: 4800,
        },
    }]);
});

test('rebuilt bundles keep the author bylines and the empty-state markers', async () => {
    const [indexBundle, dashboardBundle, indexCssBundle, dashboardCssBundle] = await Promise.all([
        readFile(INDEX_BUNDLE_PATH, 'utf8'),
        readFile(DASHBOARD_BUNDLE_PATH, 'utf8'),
        readFile(INDEX_CSS_BUNDLE_PATH, 'utf8'),
        readFile(DASHBOARD_CSS_BUNDLE_PATH, 'utf8'),
    ]);

    assert.match(indexBundle, /card__author/);
    assert.match(indexBundle, /showEmptyState:!1/);
    assert.match(indexBundle, /Não foi possível carregar os eventos no momento\./);
    assert.match(indexBundle, /Nenhum evento encontrado para os filtros aplicados\./);
    assert.match(indexBundle, /Por \$\{/);
    assert.match(indexBundle, /atrás/);
    assert.match(indexBundle, /em /);
    assert.match(dashboardBundle, /dashboard-event__author/);
    assert.match(dashboardBundle, /Por \$\{/);
    assert.match(dashboardBundle, /atrás/);
    assert.match(dashboardBundle, /Timeline: /);
    assert.match(indexCssBundle, /\.card__author\{/);
    assert.match(indexCssBundle, /\.empty-state\{/);
    assert.match(dashboardCssBundle, /\.empty-state\{/);
    assert.match(dashboardCssBundle, /\.dashboard-event__author\{/);
});