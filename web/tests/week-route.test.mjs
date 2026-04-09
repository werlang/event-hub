import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { getCurrentWeekRangeLocal } from '../src/js/helpers/week-range.js';

const WEEK_CALENDAR_JOIN_URL = 'https://calendar.google.com/calendar/u/0?cid=Y19mODgwNjAxMTJlNmUxYTA5OTBiMzYxNjcwYmRjZmUzYWI3MmYwYzU3YjM3MTMxNDA0YmRkMDZhNzZjYmIxMmRiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const WEEK_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/week.html');

/**
 * Returns one free localhost port for a disposable web server.
 */
async function getAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();

        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close((closeError) => {
                if (closeError) {
                    reject(closeError);
                    return;
                }

                resolve(port);
            });
        });
    });
}

/**
 * Waits until the spawned web server begins responding.
 */
async function waitForServer(url, childProcess) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 5000) {
        if (childProcess.exitCode !== null) {
            throw new Error(`Web server exited early with code ${childProcess.exitCode}.`);
        }

        try {
            const response = await fetch(url);
            await response.text();
            return;
        } catch {
            await delay(100);
        }
    }

    throw new Error('Timed out waiting for the web server to start.');
}

/**
 * Starts the web server on a disposable port and registers cleanup.
 */
async function startWebServer(t) {
    const port = await getAvailablePort();
    const childProcess = spawn(process.execPath, ['app.js'], {
        cwd: WEB_ROOT,
        env: {
            ...process.env,
            PORT: String(port),
            API_URL: 'http://api.test',
            GOOGLE_CALENDAR_JOIN_URL: WEEK_CALENDAR_JOIN_URL,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    childProcess.stderr.on('data', (chunk) => {
        stderr += String(chunk);
    });

    t.after(() => {
        if (childProcess.exitCode === null) {
            childProcess.kill('SIGTERM');
        }
    });

    await waitForServer(`http://127.0.0.1:${port}/week`, childProcess).catch((error) => {
        throw new Error(stderr ? `${error.message}\n${stderr}` : error.message);
    });

    return { port };
}

/**
 * Extracts the template JSON payload emitted by the render middleware.
 */
function readTemplateVars(html) {
    const match = html.match(/<script id="template-vars" type="application\/json">([\s\S]*?)<\/script>/i);
    assert.ok(match?.[1], 'Expected template vars script in the rendered HTML.');
    return JSON.parse(match[1]);
}

test('week template references the dedicated standalone bundle', async () => {
    const template = await readFile(WEEK_TEMPLATE_PATH, 'utf8');

    assert.match(template, /<link rel="stylesheet" href="\/css\/week\.min\.css">/i);
    assert.match(template, /<script type="module" src="\/js\/week\.min\.js"><\/script>/i);
    assert.match(template, /id="week-page-title"/i);
    assert.match(template, /id="week-range-label"/i);
    assert.match(template, /id="week-calendar-tooltip"/i);
    assert.match(template, /id="events-grid"/i);
    assert.match(template, /id="week-events-pagination"/i);
});

test('week route renders the current public week range into the template vars', async (t) => {
    const { port } = await startWebServer(t);
    const expectedRange = getCurrentWeekRangeLocal();
    const response = await fetch(`http://127.0.0.1:${port}/week`);
    const html = await response.text();
    const templateVars = readTemplateVars(html);

    assert.equal(response.status, 200);
    assert.equal(templateVars.weekFrom, expectedRange.from);
    assert.equal(templateVars.weekTo, expectedRange.to);
    assert.ok(templateVars.weekRangeLabel);
    assert.equal(templateVars.weekCalendarJoinUrl, WEEK_CALENDAR_JOIN_URL);
    assert.match(html, /Agenda da semana/i);
    assert.match(html, /Eventos Campus Charqueadas/i);
    assert.match(html, />\s*Google Agenda\s*</i);
    assert.match(html, new RegExp(WEEK_CALENDAR_JOIN_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});