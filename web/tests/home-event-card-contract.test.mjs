import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const EVENT_CARD_SOURCE_PATH = path.join(WEB_ROOT, 'src/js/components/event-card.js');
const EVENT_CARD_CSS_PATH = path.join(WEB_ROOT, 'src/css/components/event-card.css');
const INDEX_JS_BUNDLE_PATH = path.join(WEB_ROOT, 'public/js/index.min.js');
const INDEX_CSS_BUNDLE_PATH = path.join(WEB_ROOT, 'public/css/index.min.css');

test('public event card source follows the dashboard-inspired header and metadata structure', async () => {
    const source = await readFile(EVENT_CARD_SOURCE_PATH, 'utf8');

    assert.match(source, /header\.className\s*=\s*'card__header';/);
    assert.match(source, /headline\.className\s*=\s*'card__headline';/);
    assert.match(source, /statusGroup\.className\s*=\s*'card__status-group';/);
    assert.match(source, /createTimelinePill\(this\.#event\)/);
    assert.match(source, /createCategoryMetaItem\(this\.#event\)/);
    assert.match(source, /createGoogleCalendarMetaItem\(this\.#event\)/);
    assert.match(source, /createMetaItem\('location-dot',[\s\S]*'location'\)/);
    assert.match(source, /createMetaItem\('calendar-days',[\s\S]*'date'\)/);
    assert.match(source, /card__meta-link card__meta-link--calendar/);
});

test('public event card stylesheet defines the shared card hierarchy and pill variants', async () => {
    const css = await readFile(EVENT_CARD_CSS_PATH, 'utf8');

    assert.match(css, /\.card__header/);
    assert.match(css, /\.card__headline/);
    assert.match(css, /\.card__status-group/);
    assert.match(css, /\.card__status--upcoming/);
    assert.match(css, /\.card__status--past/);
    assert.match(css, /\.card__meta-item--category/);
    assert.match(css, /\.card__meta-item--calendar/);
    assert.match(css, /\.card__meta-item--location/);
    assert.match(css, /\.card__meta-item--date/);
});

test('compiled home bundles keep the updated public card structure markers', async () => {
    const [indexBundle, indexCssBundle] = await Promise.all([
        readFile(INDEX_JS_BUNDLE_PATH, 'utf8'),
        readFile(INDEX_CSS_BUNDLE_PATH, 'utf8'),
    ]);

    assert.match(indexBundle, /card__header/);
    assert.match(indexBundle, /card__status-group/);
    assert.match(indexBundle, /card__meta-item/);
    assert.match(indexBundle, /Google Agenda/);
    assert.match(indexCssBundle, /card__header/);
    assert.match(indexCssBundle, /\.card__status-group/);
    assert.match(indexCssBundle, /\.card__meta-item--category/);
    assert.match(indexCssBundle, /\.card__meta-item--calendar/);
});