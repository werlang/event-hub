import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { JSDOM } from 'jsdom';

import { BaseComponent } from '../src/js/components/base-component.js';
import { Button } from '../src/js/components/button.js';
import { Form } from '../src/js/components/form.js';
import { DashboardActionTabs } from '../src/js/dashboard/action-tabs.js';
import { DashboardFilters } from '../src/js/dashboard/filters.js';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const DASHBOARD_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/dashboard.html');
const DASHBOARD_SETTINGS_PANELS_PATH = path.join(WEB_ROOT, 'src/js/dashboard/settings-panels.js');
const DASHBOARD_CREATE_EVENT_MODAL_TEMPLATE_PATH = path.join(WEB_ROOT, 'public/html/dashboard-create-event-modal.html');

/**
 * Waits until the current microtask queue and one event-loop turn settle.
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
 * Installs one JSDOM window as the active global DOM for modules loaded outside the VM.
 */
function installDomGlobals(dom) {
    const keys = [
        'window',
        'document',
        'navigator',
        'Node',
        'Text',
        'Element',
        'HTMLElement',
        'HTMLButtonElement',
        'HTMLInputElement',
        'HTMLSelectElement',
        'HTMLTextAreaElement',
        'HTMLFormElement',
        'DocumentFragment',
        'FormData',
        'Event',
        'MouseEvent',
        'KeyboardEvent',
        'CustomEvent',
        'localStorage',
        'getComputedStyle',
    ];
    const previousValues = new Map();
    const previousDescriptors = new Map();

    for (const key of keys) {
        previousValues.set(key, globalThis[key]);
        previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {
            configurable: true,
            writable: true,
            value: dom.window[key],
        });
    }

    return () => {
        for (const key of keys) {
            const previousDescriptor = previousDescriptors.get(key);
            const previousValue = previousValues.get(key);

            if (!previousDescriptor && previousValue === undefined) {
                delete globalThis[key];
                continue;
            }

            if (previousDescriptor) {
                Object.defineProperty(globalThis, key, previousDescriptor);
                continue;
            }

            Object.defineProperty(globalThis, key, {
                configurable: true,
                writable: true,
                value: previousValue,
            });
        }
    };
}

/**
 * Creates one JSDOM document for a dashboard interaction test.
 */
function createDom(html, url = 'http://localhost/dashboard') {
    const dom = new JSDOM(html, {
        url,
        pretendToBeVisual: true,
    });

    if (typeof dom.window.HTMLElement.prototype.scrollIntoView !== 'function') {
        dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
    }

    return dom;
}

/**
 * Removes ESM import declarations so one source file can be loaded inside a VM.
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
 * Rewrites the dashboard settings source into a VM-loadable class definition.
 */
function transformSettingsPanelsSource(source) {
    return stripImports(source)
        .replace('export class DashboardSettingsPanels extends BaseComponent {', 'class DashboardSettingsPanels extends BaseComponent {')
        .replace(/\nexport default DashboardSettingsPanels;\s*$/, '\n')
        .concat('\nglobalThis.__dashboardUi = { DashboardSettingsPanels };\n');
}

/**
 * Creates one Toast stub that records the toasts emitted by a workflow.
 */
function createToastRecorder() {
    const recorded = {
        dismisses: [],
        shows: [],
    };

    return {
        recorded,
        Toast: {
            dismissGroup(group) {
                recorded.dismisses.push(group);
            },
            show(text, options = {}) {
                recorded.shows.push({ text, options: normalizeValue(options) });
                return { text, options };
            },
        },
    };
}

/**
 * Creates an auth facade stub that records request contracts.
 */
function createAuthApiRecorder(recordRequest, { storeToken = () => {} } = {}) {
    return {
        updateProfile(token, payload) {
            return recordRequest('/auth/me', { method: 'PUT', token, body: payload });
        },
        changePassword(token, payload) {
            return recordRequest('/auth/password', { method: 'PUT', token, body: payload });
        },
        updatePreferences(token, emailPreferences) {
            return recordRequest('/auth/me/preferences', { method: 'PUT', token, body: { emailPreferences } });
        },
        sendWeeklyDigest(token, payload) {
            return recordRequest('/auth/weekly-digest/send', { method: 'POST', token, body: payload });
        },
        storeToken,
    };
}

/**
 * Creates a user facade stub that records request contracts.
 */
function createUserApiRecorder(recordRequest) {
    return {
        list(token) {
            return recordRequest('/users', { token });
        },
        adminResetPassword(token, payload) {
            return recordRequest('/users/password/reset', { method: 'PUT', token, body: payload });
        },
        promote(token, userId) {
            return recordRequest(`/users/${userId}/promote`, { method: 'PUT', token });
        },
    };
}

/**
 * Dispatches one submit event against a real form element.
 */
async function submitForm(dom, selector) {
    const form = dom.window.document.querySelector(selector);
    assert.ok(form, `Expected form ${selector} to exist.`);
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
}

/**
 * Loads the settings panels controller against the real dashboard settings markup.
 */
async function loadSettingsScenario({ requestApiImpl }) {
    const html = await readFile(DASHBOARD_TEMPLATE_PATH, 'utf8');
    const dom = createDom(html);
    const restoreDom = installDomGlobals(dom);
    const requestCalls = [];
    const storedTokens = [];
    const sessionChanges = [];
    let resetCalls = 0;
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const source = await readFile(DASHBOARD_SETTINGS_PANELS_PATH, 'utf8');
        const sandbox = vm.createContext({
            console,
            window: dom.window,
            document: dom.window.document,
            Element: dom.window.Element,
            BaseComponent,
            Button,
            Form,
            Toast,
            authApi: createAuthApiRecorder(async (path, options = {}) => {
                requestCalls.push({ path, options: normalizeValue(options) });
                return requestApiImpl(path, options);
            }, {
                storeToken(token) {
                    storedTokens.push(token);
                },
            }),
            userApi: createUserApiRecorder(async (path, options = {}) => {
                requestCalls.push({ path, options: normalizeValue(options) });
                return requestApiImpl(path, options);
            }),
            resetCurrentSession() {
                resetCalls += 1;
            },
        });
        sandbox.globalThis = sandbox;
        vm.runInContext(transformSettingsPanelsSource(source), sandbox, {
            filename: DASHBOARD_SETTINGS_PANELS_PATH,
        });

        const panels = new sandbox.__dashboardUi.DashboardSettingsPanels({
            section: dom.window.document.querySelector('#dashboard-settings-section'),
        });
        panels.onSessionChange((detail) => {
            sessionChanges.push(normalizeValue(detail));
        });

        return {
            dom,
            panels,
            requestCalls,
            storedTokens,
            sessionChanges,
            toastRecorded,
            readResetCalls() {
                return resetCalls;
            },
            restore() {
                restoreDom();
                dom.window.close();
            },
        };
    } catch (error) {
        restoreDom();
        dom.window.close();
        throw error;
    }
}

test('DashboardActionTabs keeps the current-state accessibility markers in sync and skips hidden tabs during keyboard navigation', async () => {
    const dom = createDom(`
        <div data-dashboard-action-tabs>
            <button type="button" data-dashboard-action-tab="browse">Seus envios</button>
            <button type="button" data-dashboard-action-tab="moderation" hidden>Moderar</button>
            <button type="button" data-dashboard-action-tab="create">Novo evento</button>
            <button type="button" data-dashboard-action-tab="settings">Configurações</button>
        </div>
    `);
    const restoreDom = installDomGlobals(dom);
    const calls = [];

    try {
        const { document } = dom.window;
        const tabs = Array.from(document.querySelectorAll('[data-dashboard-action-tab]'));
        const actionTabs = new DashboardActionTabs({
            tabList: document.querySelector('[data-dashboard-action-tabs]'),
            tabs,
            onAction: async (nextTab, currentTab) => {
                calls.push({ nextTab, currentTab });
                return nextTab;
            },
        });

        actionTabs.wire().setActive('browse');

        const [browseTab, moderationTab, createTab, settingsTab] = tabs;
        assert.equal(browseTab.getAttribute('aria-pressed'), 'true');
        assert.equal(createTab.getAttribute('aria-pressed'), 'false');
        assert.equal(settingsTab.getAttribute('aria-pressed'), 'false');

        browseTab.focus();
        browseTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert.equal(document.activeElement, createTab);

        createTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await flushMicrotasks();

        assert.deepEqual(calls, [{ nextTab: 'create', currentTab: 'browse' }]);
        assert.equal(createTab.classList.contains('dashboard-action-tab--current'), true);
        assert.equal(createTab.getAttribute('aria-pressed'), 'true');
        assert.equal(browseTab.getAttribute('aria-pressed'), 'false');
        assert.equal(moderationTab.getAttribute('aria-pressed'), 'false');

        createTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        assert.equal(document.activeElement, settingsTab);

        settingsTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        assert.equal(document.activeElement, browseTab);
    } finally {
        restoreDom();
        dom.window.close();
    }
});

test('DashboardActionTabs destroy clears the delegated click and keyboard listeners', async () => {
    const dom = createDom(`
        <div data-dashboard-action-tabs>
            <button type="button" data-dashboard-action-tab="browse">Seus envios</button>
            <button type="button" data-dashboard-action-tab="create">Novo evento</button>
        </div>
    `);
    const restoreDom = installDomGlobals(dom);
    const calls = [];

    try {
        const { document } = dom.window;
        const actionTabs = new DashboardActionTabs({
            tabList: document.querySelector('[data-dashboard-action-tabs]'),
            tabs: Array.from(document.querySelectorAll('[data-dashboard-action-tab]')),
            onAction: async (nextTab) => {
                calls.push(nextTab);
                return nextTab;
            },
        });

        actionTabs.wire().destroy();

        document.querySelector('[data-dashboard-action-tab="create"]').dispatchEvent(
            new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
        );
        document.querySelector('[data-dashboard-action-tab="create"]').dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        await flushMicrotasks();

        assert.deepEqual(calls, []);
    } finally {
        restoreDom();
        dom.window.close();
    }
});

test('dashboard create-event modal template disables native form validation while keeping app-required fields', async () => {
    const html = await readFile(DASHBOARD_CREATE_EVENT_MODAL_TEMPLATE_PATH, 'utf8');
    const dom = createDom(html);

    try {
        const { document } = dom.window;
        const form = document.querySelector('#dashboard-modal-create-form');
        assert.ok(form);
        assert.equal(form.noValidate, true);
        assert.equal(document.querySelector('#dashboard-modal-event-title').hasAttribute('required'), true);
        assert.equal(document.querySelector('#dashboard-modal-event-description').hasAttribute('required'), true);
        assert.equal(document.querySelector('#dashboard-modal-event-date').hasAttribute('required'), true);
    } finally {
        dom.window.close();
    }
});

test('DashboardFilters rebuilds sorted category options, resets stale selections, and normalizes emitted values', () => {
    const dom = createDom(`
        <form class="dashboard-events-filters">
            <select id="status">
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="rejected">Rejeitados</option>
            </select>
            <select id="category">
                <option value="all">Todas</option>
            </select>
            <label>
                <input id="include-past" type="checkbox">
            </label>
            <select id="order">
                <option value="desc">Mais recentes</option>
                <option value="asc">Mais antigos</option>
            </select>
        </form>
    `);
    const restoreDom = installDomGlobals(dom);
    const changes = [];

    try {
        const { document } = dom.window;
        const root = document.querySelector('.dashboard-events-filters');
        const statusField = document.querySelector('#status');
        const categoryField = document.querySelector('#category');
        const showPastField = document.querySelector('#include-past');
        const orderField = document.querySelector('#order');
        const filters = new DashboardFilters({
            root,
            statusField,
            categoryField,
            showPastField,
            orderField,
            onChange(nextFilters) {
                changes.push(normalizeValue(nextFilters));
            },
        });

        filters.wire();
        const normalizedFilters = filters.render({
            events: [
                { id: 'evt-ext-1', category: 'extensao', status: 'published', date: '2099-05-02T10:00:00.000Z' },
                { id: 'evt-academic-1', category: 'academico', status: 'pending', date: '2099-05-03T10:00:00.000Z' },
                { id: 'evt-academic-2', category: 'Acadêmico', status: 'rejected', date: '2099-05-04T10:00:00.000Z' },
            ],
            filters: {
                status: ' REJECTED ',
                category: 'categoria-inexistente',
                includePast: 1,
                order: 'ASC',
            },
        });

        assert.deepEqual(normalizedFilters, {
            status: 'rejected',
            category: 'all',
            includePast: true,
            order: 'asc',
        });
        assert.deepEqual(
            Array.from(categoryField.options).map(option => option.value),
            ['all', 'academico', 'extensao'],
        );

        statusField.value = 'pending';
        categoryField.value = 'academico';
        showPastField.checked = true;
        orderField.value = 'asc';
        statusField.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

        assert.deepEqual(changes, [{
            status: 'pending',
            category: 'academico',
            includePast: true,
            order: 'asc',
        }]);

        root.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
        assert.equal(changes.length, 1);
    } finally {
        restoreDom();
        dom.window.close();
    }
});

test('DashboardSettingsPanels blocks admin reset and promote requests when the session token is missing', async () => {
    const scenario = await loadSettingsScenario({
        requestApiImpl() {
            throw new Error('Admin settings requests should not run without a session token.');
        },
    });

    try {
        scenario.panels.setSession({
            isAuthenticated: true,
            token: '',
            user: {
                id: 'admin-1',
                name: 'Admin',
                email: 'admin@ifsul.edu.br',
                role: 'admin',
                emailPreferences: {
                    eventUpdates: true,
                    adminPendingRequests: true,
                },
            },
        });

        const { document } = scenario.dom.window;
        document.querySelector('#dashboard-settings-admin-reset-email').value = 'membro@ifsul.edu.br';
        document.querySelector('#dashboard-settings-admin-reset-password').value = 'nova-senha';
        await submitForm(scenario.dom, '#dashboard-settings-admin-reset-form');

        document.querySelector('#dashboard-settings-admin-promote-email').value = 'membro@ifsul.edu.br';
        await submitForm(scenario.dom, '#dashboard-settings-admin-promote-form');

        assert.deepEqual(scenario.requestCalls, []);
        assert.deepEqual(
            scenario.toastRecorded.shows.map(call => call.text),
            [
                'Não foi possível validar a sua sessão agora.',
                'Não foi possível validar a sua sessão agora.',
            ],
        );
    } finally {
        scenario.restore();
    }
});

test('DashboardSettingsPanels blocks the manual digest trigger when the session token is missing', async () => {
    const scenario = await loadSettingsScenario({
        requestApiImpl() {
            throw new Error('The manual digest request should not run without a session token.');
        },
    });

    try {
        scenario.panels.setSession({
            isAuthenticated: true,
            token: '',
            user: {
                id: 'admin-1',
                name: 'Admin',
                email: 'admin@ifsul.edu.br',
                role: 'admin',
                emailPreferences: {
                    eventUpdates: true,
                    adminPendingRequests: true,
                },
            },
        });

        const digestButton = scenario.dom.window.document.querySelector('#dashboard-settings-admin-digest-submit');
        assert.ok(digestButton, 'Expected the admin digest button to exist.');
        digestButton.dispatchEvent(new scenario.dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        await flushMicrotasks();

        assert.deepEqual(scenario.requestCalls, []);
        assert.deepEqual(
            scenario.toastRecorded.shows.map(call => call.text),
            ['Não foi possível validar a sua sessão agora.'],
        );
    } finally {
        scenario.restore();
    }
});

test('DashboardSettingsPanels includes the admin pending-request flag in the email-preferences payload for administrators', async () => {
    const scenario = await loadSettingsScenario({
        requestApiImpl(path, options) {
            assert.equal(path, '/auth/me/preferences');

            return {
                ok: true,
                message: 'Preferências atualizadas.',
                data: {
                    token: 'updated-admin-token',
                    user: {
                        id: 'admin-1',
                        name: 'Admin',
                        email: 'admin@ifsul.edu.br',
                        role: 'admin',
                        emailPreferences: options.body.emailPreferences,
                    },
                },
            };
        },
    });

    try {
        scenario.panels.setSession({
            isAuthenticated: true,
            token: 'admin-token',
            user: {
                id: 'admin-1',
                name: 'Admin',
                email: 'admin@ifsul.edu.br',
                role: 'admin',
                emailPreferences: {
                    eventUpdates: true,
                    adminPendingRequests: false,
                },
            },
        });

        const { document } = scenario.dom.window;
        document.querySelector('#dashboard-settings-email-event-updates').checked = false;
        document.querySelector('#dashboard-settings-email-admin-pending').checked = true;
        await submitForm(scenario.dom, '#dashboard-settings-preferences-form');

        assert.deepEqual(scenario.requestCalls, [{
            path: '/auth/me/preferences',
            options: {
                method: 'PUT',
                token: 'admin-token',
                body: {
                    emailPreferences: {
                        eventUpdates: false,
                        adminPendingRequests: true,
                    },
                },
            },
        }]);
        assert.deepEqual(scenario.storedTokens, ['updated-admin-token']);
        assert.equal(scenario.readResetCalls(), 1);
        assert.equal(scenario.sessionChanges.length, 1);
    } finally {
        scenario.restore();
    }
});
