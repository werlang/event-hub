import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const HOME_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/index.html');
const DASHBOARD_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/dashboard.html');
const SHARED_FILTER_SURFACE_PATH = path.join(WEB_ROOT, 'src/css/components/filter-surface.css');
const DASHBOARD_FILTERS_PATH = path.join(WEB_ROOT, 'src/css/components/dashboard-filters.css');
const INDEX_BUNDLE_PATH = path.join(WEB_ROOT, 'public/css/index.min.css');
const DASHBOARD_BUNDLE_PATH = path.join(WEB_ROOT, 'public/css/dashboard.min.css');

/**
 * Returns one free localhost port for an integration test server.
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
 * Waits until the spawned web server starts responding.
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
 * Starts the worker-local web server on a disposable port and registers cleanup.
 */
async function startWebServer(t) {
    const port = await getAvailablePort();
    const childProcess = spawn(process.execPath, ['app.js'], {
        cwd: WEB_ROOT,
        env: {
            ...process.env,
            PORT: String(port),
            API_URL: 'http://api.test',
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

    await waitForServer(`http://127.0.0.1:${port}/`, childProcess).catch((error) => {
        throw new Error(stderr ? `${error.message}\n${stderr}` : error.message);
    });

    return {
        port,
    };
}

test('templates attach the shared filter surface classes to home and dashboard', async () => {
    const homeTemplate = await readFile(HOME_TEMPLATE_PATH, 'utf8');
    const dashboardTemplate = await readFile(DASHBOARD_TEMPLATE_PATH, 'utf8');

    assert.match(homeTemplate, /class="home-filters filter-surface"/i);
    assert.match(homeTemplate, /class="form form--visible filter-surface__grid home-filters__form"/i);
    assert.match(dashboardTemplate, /class="dashboard-events-filters filter-surface"/i);
    assert.match(dashboardTemplate, /class="dashboard-events-filters__grid filter-surface__grid"/i);
});

test('shared filter surface stylesheet keeps the reusable grid and mobile fallback', async () => {
    const sharedFilterSurface = await readFile(SHARED_FILTER_SURFACE_PATH, 'utf8');

    assert.match(sharedFilterSurface, /\.filter-surface\s*\{/);
    assert.match(sharedFilterSurface, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(180px,\s*1fr\)\)/);
    assert.match(sharedFilterSurface, /@media\s*\(max-width:\s*720px\)/);
    assert.match(sharedFilterSurface, /grid-template-columns:\s*1fr/);
});

test('dashboard checkbox treatment stays local to dashboard filters', async () => {
    const sharedFilterSurface = await readFile(SHARED_FILTER_SURFACE_PATH, 'utf8');
    const dashboardFilters = await readFile(DASHBOARD_FILTERS_PATH, 'utf8');

    assert.match(dashboardFilters, /\.dashboard-events-filters__checkbox/);
    assert.doesNotMatch(sharedFilterSurface, /dashboard-events-filters__checkbox/);
});

test('home and dashboard routes render the shared filter surface shells', async (t) => {
    const { port } = await startWebServer(t);
    const [homeResponse, dashboardResponse] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/`),
        fetch(`http://127.0.0.1:${port}/dashboard`),
    ]);
    const [homeHtml, dashboardHtml] = await Promise.all([
        homeResponse.text(),
        dashboardResponse.text(),
    ]);

    assert.equal(homeResponse.status, 200);
    assert.equal(dashboardResponse.status, 200);
    assert.match(homeHtml, /class="home-filters filter-surface"/i);
    assert.match(homeHtml, /class="form form--visible filter-surface__grid home-filters__form"/i);
    assert.match(dashboardHtml, /class="dashboard-events-filters filter-surface"/i);
    assert.match(dashboardHtml, /class="dashboard-events-filters__grid filter-surface__grid"/i);
});

test('compiled css bundles include the shared filter surface and dashboard checkbox rules', async () => {
    const [indexBundle, dashboardBundle] = await Promise.all([
        readFile(INDEX_BUNDLE_PATH, 'utf8'),
        readFile(DASHBOARD_BUNDLE_PATH, 'utf8'),
    ]);

    assert.match(indexBundle, /\.filter-surface\{/);
    assert.match(dashboardBundle, /\.filter-surface\{/);
    assert.match(dashboardBundle, /\.dashboard-events-filters__checkbox/);
});