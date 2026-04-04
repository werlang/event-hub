import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import { createDefaultHomeFilters, readHomeFiltersFromUrl } from '../src/js/helpers/query-state.js';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const INDEX_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/index.html');

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
		childProcess,
	};
}

/**
 * Extracts the rendered value of one input by id from the home HTML.
 */
function readInputValue(html, inputId) {
	const escapedId = inputId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = html.match(new RegExp(`<input[^>]*id="${escapedId}"[^>]*value="([^"]*)"`, 'i'));
	return match?.[1] || '';
}

test('createDefaultHomeFilters returns a local seven-day window', () => {
	const referenceDate = new Date('2026-04-03T12:00:00');

	assert.deepEqual(createDefaultHomeFilters(referenceDate), {
		search: '',
		category: '',
		from: '2026-04-03',
		to: '2026-04-09',
	});
});

test('readHomeFiltersFromUrl keeps fallback dates for empty and partial URLs', () => {
	const fallbackFilters = {
		search: '',
		category: '',
		from: '2026-04-03',
		to: '2026-04-09',
	};

	assert.deepEqual(readHomeFiltersFromUrl('', fallbackFilters), fallbackFilters);
	assert.deepEqual(readHomeFiltersFromUrl('?category=academico', fallbackFilters), {
		search: '',
		category: 'academico',
		from: '2026-04-03',
		to: '2026-04-09',
	});
	assert.deepEqual(readHomeFiltersFromUrl('?q=seminario', fallbackFilters), {
		search: 'seminario',
		category: '',
		from: '2026-04-03',
		to: '2026-04-09',
	});
});

test('readHomeFiltersFromUrl preserves explicit date ranges from the URL', () => {
	const fallbackFilters = {
		search: '',
		category: '',
		from: '2026-04-03',
		to: '2026-04-09',
	};

	assert.deepEqual(readHomeFiltersFromUrl('?from=2026-05-10&to=2026-05-14', fallbackFilters), {
		search: '',
		category: '',
		from: '2026-05-10',
		to: '2026-05-14',
	});
});

test('index template binds the server-provided default date values', async () => {
	const template = await readFile(INDEX_TEMPLATE_PATH, 'utf8');

	assert.match(template, /id="filter-from"[^>]*value="\{\{defaultFrom\}\}"/i);
	assert.match(template, /id="filter-to"[^>]*value="\{\{defaultTo\}\}"/i);
});

test('home route renders the current default date window into the SSR inputs', async (t) => {
	const { port } = await startWebServer(t);
	const expectedDefaults = createDefaultHomeFilters();
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const html = await response.text();

	assert.equal(response.status, 200);
	assert.equal(readInputValue(html, 'filter-from'), expectedDefaults.from);
	assert.equal(readInputValue(html, 'filter-to'), expectedDefaults.to);
});