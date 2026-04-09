import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { JSDOM } from 'jsdom';

import { BaseComponent } from '../src/js/components/base-component.js';
import { Button } from '../src/js/components/button.js';
import { Form } from '../src/js/components/form.js';
import { Pagination } from '../src/js/components/pagination.js';
import { DashboardActionTabs } from '../src/js/dashboard/action-tabs.js';
import {
    DashboardFilters,
    createDefaultDashboardBrowseFilters,
    filterDashboardBrowseEvents,
    formatDashboardBrowseBadge,
    readDashboardBrowseCaption,
    readDashboardBrowseEmptyState,
} from '../src/js/dashboard/filters.js';
import {
    canDeleteOwnEvent,
    canEditOwnEvent,
    isPendingLikeEventStatus,
    normalizeEventStatus,
    serializeDateTimeLocalInputValue,
} from '../src/js/dashboard/event-management.js';
import { Event } from '../src/js/helpers/event.js';
import { createHomeFilterParams } from '../src/js/helpers/query-state.js';
import { getCurrentWeekRangeLocal } from '../src/js/helpers/week-range.js';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const HOME_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/index.js');
const LOGIN_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/login.js');
const WEEK_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/week.js');
const DASHBOARD_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/dashboard.js');
const DASHBOARD_SETTINGS_PANELS_PATH = path.join(WEB_ROOT, 'src/js/dashboard/settings-panels.js');
const DASHBOARD_CREATE_EVENT_MODAL_PATH = path.join(WEB_ROOT, 'src/js/dashboard/create-event-modal.js');
const DASHBOARD_DELETE_EVENT_MODAL_PATH = path.join(WEB_ROOT, 'src/js/dashboard/delete-event-modal.js');
const DASHBOARD_REJECT_EVENT_MODAL_PATH = path.join(WEB_ROOT, 'src/js/dashboard/reject-event-modal.js');
const INDEX_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/index.html');
const WEEK_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/week.html');
const DASHBOARD_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/dashboard.html');
const CREATE_EVENT_MODAL_TEMPLATE_PATH = path.join(WEB_ROOT, 'public/html/dashboard-create-event-modal.html');
const REJECT_EVENT_MODAL_TEMPLATE_PATH = path.join(WEB_ROOT, 'public/html/dashboard-reject-event-modal.html');

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
 * Creates one JSDOM document for a workflow test.
 */
function createDom(html, url) {
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
 * Runs a transformed source file inside a VM and returns its exported test hooks.
 */
async function loadVmHooks({ filePath, transform, context, hookName }) {
    const source = await readFile(filePath, 'utf8');
    const sandbox = vm.createContext({
        console,
        URLSearchParams,
        ...context,
    });
    sandbox.globalThis = sandbox;
    vm.runInContext(transform(source), sandbox, { filename: filePath });
    return {
        hooks: sandbox[hookName],
        sandbox,
    };
}

/**
 * Rewrites the home entry source into a callable script with one exported hook.
 */
function transformHomeEntrypointSource(source) {
    return stripImports(source)
        .replace('export function initHomePage() {', 'function initHomePage() {')
        .replace('\nnew Header();\n', '\n')
        .replace(/\ninitHomePage\(\);\s*$/, '\n')
        .concat('\nglobalThis.__workflowHome = { initHomePage };\n');
}

/**
 * Rewrites the login entry source into callable workflow helpers.
 */
function transformLoginEntrypointSource(source) {
    return stripImports(source)
    .replace('\nnew Header();\n', '\n')
        .replace(/\ninitAuthTabs\(\);\s*$/, '\n')
        .concat('\nglobalThis.__workflowLogin = { readRedirectTarget, submitLogin, submitRegister };\n');
}

/**
 * Rewrites the week entry source into a callable script with one exported hook.
 */
function transformWeekEntrypointSource(source) {
    return stripImports(source)
    .replace('\nnew Header();\n', '\n')
        .replace('export function initWeekPage() {', 'function initWeekPage() {')
        .replace(/\ninitWeekPage\(\);\s*$/, '\n')
        .concat('\nglobalThis.__workflowWeek = { initWeekPage, createWeekEventsPath, readCurrentWeekRange };\n');
}

/**
 * Rewrites the dashboard settings source into a VM-loadable class definition.
 */
function transformSettingsPanelsSource(source) {
    return stripImports(source)
        .replace('export class DashboardSettingsPanels extends BaseComponent {', 'class DashboardSettingsPanels extends BaseComponent {')
        .replace(/\nexport default DashboardSettingsPanels;\s*$/, '\n')
        .concat('\nglobalThis.__workflowSettings = { DashboardSettingsPanels };\n');
}

/**
 * Rewrites the event-form modal source into a VM-loadable class definition.
 */
function transformCreateEventModalSource(source) {
    return stripImports(source)
        .replace('export class DashboardEventFormModal {', 'class DashboardEventFormModal {')
        .replace(/\nexport \{ DashboardEventFormModal as DashboardCreateEventModal \};\n\nexport default DashboardEventFormModal;\s*$/, '\n')
        .concat('\nglobalThis.__workflowCreateEvent = { DashboardEventFormModal };\n');
}

/**
 * Rewrites the delete-event modal source into a VM-loadable class definition.
 */
function transformDeleteEventModalSource(source) {
    return stripImports(source)
        .replace('export class DashboardDeleteEventModal {', 'class DashboardDeleteEventModal {')
        .replace(/\nexport default DashboardDeleteEventModal;\s*$/, '\n')
        .concat('\nglobalThis.__workflowDeleteEvent = { DashboardDeleteEventModal };\n');
}

/**
 * Rewrites the reject-event modal source into a VM-loadable class definition.
 */
function transformRejectEventModalSource(source) {
    return stripImports(source)
        .replace('export class DashboardRejectEventModal {', 'class DashboardRejectEventModal {')
        .replace(/\nexport default DashboardRejectEventModal;\s*$/, '\n')
        .concat('\nglobalThis.__workflowRejectEvent = { DashboardRejectEventModal };\n');
}

/**
 * Rewrites the dashboard entry source into a VM-loadable controller and helper set.
 */
function transformDashboardEntrypointSource(source) {
    return stripImports(source)
        .replace(/\nnew DashboardPage\(\)\.init\(\);\s*$/, '\n')
        .concat('\nglobalThis.__workflowDashboard = { DashboardPage, createDashboardEventElement, handleModerationQueueActionRequest, readModerationEventActionDefinitions, readModerationEventSourcePath, filterAdminPublishedDiscoveryEvents, filterAdminRejectedDiscoveryEvents, syncModerationEventsAfterAdminEdit };\n');
}

/**
 * Creates one Toast stub that records the toasts emitted by a workflow.
 */
function createToastRecorder() {
    const recorded = {
        dismisses: [],
        shows: [],
        flashes: [],
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
            flash(text, options = {}) {
                recorded.flashes.push({ text, options: normalizeValue(options) });
                return { text, options };
            },
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
 * Dispatches one click event against a real DOM element.
 */
async function clickElement(dom, selector) {
    const element = dom.window.document.querySelector(selector);
    assert.ok(element, `Expected element ${selector} to exist.`);
    element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
}

/**
 * Creates one Tooltip stub usable by controllers that only need a host node.
 */
class TooltipStub {
    #element;

    constructor({ element = null } = {}) {
        this.#element = element || document.createElement('span');
        if (!this.#element.classList.contains('tooltip-stub')) {
            this.#element.classList.add('tooltip-stub');
        }
    }

    get() {
        return this.#element;
    }
}

/**
 * Returns one reusable modal stub class that injects preloaded HTML into the DOM.
 */
function createModalStubClass(htmlByPath) {
    return class ModalStub {
        #root;
        #body;
        #actions;
        #actionMap = new Map();
        #onClose = null;
        #isOpen = false;

        constructor({ id }) {
            this.#root = globalThis.document.createElement('section');
            this.#root.id = id;
            this.#body = globalThis.document.createElement('div');
            this.#body.className = 'modal-stub__body';
            this.#actions = globalThis.document.createElement('div');
            this.#actions.className = 'modal-stub__actions';
            this.#root.append(this.#body, this.#actions);
            globalThis.document.body.appendChild(this.#root);
        }

        onClose(callback) {
            this.#onClose = typeof callback === 'function' ? callback : null;
            return this;
        }

        async preloadContentFromFile() {
            return this;
        }

        async loadContentFromFile(filePath, { args = {} } = {}) {
            const template = String(htmlByPath[filePath] || '');
            this.#body.innerHTML = template.replace(/\{\{\s*eventTitle\s*\}\}/g, String(args.eventTitle || ''));
            return this;
        }

        setEyebrow(value) {
            this.eyebrow = value;
            return this;
        }

        setTitle(value) {
            this.title = value;
            return this;
        }

        setDescription(value) {
            this.description = value;
            return this;
        }

        setContent(content) {
            this.#body.replaceChildren();

            const appendContent = (value) => {
                if (Array.isArray(value)) {
                    value.forEach(appendContent);
                    return;
                }

                if (value instanceof globalThis.Node) {
                    this.#body.appendChild(value);
                    return;
                }

                if (typeof value === 'string' && value.trim()) {
                    this.#body.insertAdjacentHTML('beforeend', value);
                    return;
                }

                if (value != null) {
                    this.#body.appendChild(globalThis.document.createTextNode(String(value)));
                }
            };

            appendContent(content);
            return this;
        }

        addAction({
            id,
            label,
            icon,
            callback,
            tone = 'ghost',
            type = 'button',
            closeOnClick = false,
            autofocus = false,
            title,
            disabled = false,
        } = {}) {
            const button = new Button({
                element: globalThis.document.createElement('button'),
                loadingLabel: typeof label === 'string' && label.trim() ? `${label.trim()}...` : 'Carregando...',
            });

            button.get().type = type;
            button.get().className = `button ${String(tone || 'ghost').trim().toLowerCase() === 'primary' ? 'button--primary' : 'button--ghost'}`;
            button.get().replaceChildren();

            if (typeof icon === 'string' && icon.trim()) {
                const iconElement = globalThis.document.createElement('i');
                iconElement.classList.add('fa-solid', `fa-${icon.trim()}`);
                iconElement.setAttribute('aria-hidden', 'true');
                button.get().appendChild(iconElement);
            }

            const labelElement = globalThis.document.createElement('span');
            labelElement.textContent = typeof label === 'string' && label.trim() ? label.trim() : 'Continuar';
            button.get().appendChild(labelElement);

            if (typeof id === 'string' && id.trim()) {
                button.get().id = id.trim();
                this.#actionMap.set(button.get().id, button);
            }

            if (typeof title === 'string' && title.trim()) {
                button.get().setAttribute('title', title.trim());
            }

            if (autofocus) {
                button.get().autofocus = true;
            }

            button.setDisabled(disabled);
            button.click(async (event) => {
                let shouldClose = Boolean(closeOnClick);

                if (typeof callback === 'function') {
                    const result = await callback(event, this);
                    if (result === false) {
                        shouldClose = false;
                    }
                }

                if (shouldClose) {
                    this.close();
                }
            }, { manageBusy: typeof callback === 'function' });

            this.#actions.appendChild(button.get());
            return this;
        }

        getAction(id) {
            return this.#actionMap.get(id) || null;
        }

        get(selector) {
            if (!selector) {
                return this.#root;
            }

            return this.#root.matches(selector)
                ? this.#root
                : this.#root.querySelector(selector);
        }

        open(options = {}) {
            this.openOptions = options;
            this.#isOpen = true;

            if (typeof options.focusTarget === 'string') {
                this.get(options.focusTarget)?.focus?.();
            }

            return this;
        }

        close() {
            if (!this.#isOpen) {
                return this;
            }

            this.#isOpen = false;
            this.#onClose?.(this);
            return this;
        }

        destroy() {
            this.#actionMap.clear();
            this.#root.remove();
            return this;
        }
    };
}

/**
 * Loads the home entrypoint with test doubles for API, list, and chips behavior.
 */
async function loadHomeScenario({ initialFilters, responseFactory }) {
    const html = await readFile(INDEX_TEMPLATE_PATH, 'utf8');
    const dom = createDom(html, 'http://localhost/');
    const restoreDom = installDomGlobals(dom);
    const recorded = {
        requests: [],
        clears: [],
        renders: [],
        pagination: [],
        hydratedFilters: [],
        chips: [],
        applyHandler: null,
        chipHandler: null,
    };
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const { hooks } = await loadVmHooks({
            filePath: HOME_ENTRY_PATH,
            transform: transformHomeEntrypointSource,
            hookName: '__workflowHome',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                apiClient: {
                    async request(endpoint) {
                        recorded.requests.push(endpoint);
                        return responseFactory(endpoint);
                    },
                },
                Event,
                FilterForm: class FilterFormMock {
                    isReady() {
                        return true;
                    }

                    hydrate(filters) {
                        recorded.hydratedFilters.push(normalizeValue(filters));
                        return this;
                    }

                    readFilters() {
                        return normalizeValue(initialFilters);
                    }

                    bindApply(callback) {
                        recorded.applyHandler = callback;
                        return this;
                    }
                },
                EventList: class EventListMock {
                    isReady() {
                        return true;
                    }

                    clear(options = {}) {
                        recorded.clears.push(normalizeValue(options));
                        return this;
                    }

                    render(events) {
                        recorded.renders.push(normalizeValue(events));
                        return this;
                    }
                },
                Pagination: class PaginationMock {
                    onPageChange() {
                        return this;
                    }

                    clampPage(page) {
                        return Number(page) || 1;
                    }

                    readPageItems(events) {
                        return events;
                    }

                    render(detail) {
                        recorded.pagination.push(normalizeValue(detail));
                        return this;
                    }
                },
                QuickChips: class QuickChipsMock {
                    isReady() {
                        return true;
                    }

                    render(chips) {
                        recorded.chips.push(normalizeValue(chips));
                        return this;
                    }

                    bindSelect(callback) {
                        recorded.chipHandler = callback;
                        return this;
                    }
                },
                Tooltip: TooltipStub,
                Toast,
                Header: class HeaderMock {},
                createHomeFilterParams,
                hasSpecificHomeQuery() {
                    return false;
                },
                readHomeFiltersFromUrl() {
                    return normalizeValue(initialFilters);
                },
                getCurrentWeekRangeLocal() {
                    return { from: initialFilters.from, to: initialFilters.to };
                },
                getNextDaysRangeLocal() {
                    return { from: initialFilters.from, to: initialFilters.to };
                },
            },
        });

        hooks.initHomePage();
        await flushMicrotasks();

        return {
            dom,
            recorded,
            toastRecorded,
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

/**
 * Loads the login entry helpers in isolation.
 */
async function loadLoginScenario({ requestApiImpl, templateRedirect = '', search = '' }) {
    const recorded = {
        requests: [],
        storedToken: null,
        assignedTarget: null,
    };
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    const { hooks } = await loadVmHooks({
        filePath: LOGIN_ENTRY_PATH,
        transform: transformLoginEntrypointSource,
        hookName: '__workflowLogin',
        context: {
            window: {
                location: {
                    search,
                    assign(target) {
                        recorded.assignedTarget = target;
                    },
                },
            },
            TemplateVar: {
                get(key) {
                    return key === 'redirect' ? templateRedirect : '';
                },
            },
            Toast,
            storeToken(token) {
                recorded.storedToken = token;
            },
            requestApi: async (path, options = {}) => {
                recorded.requests.push({ path, options: normalizeValue(options) });
                return requestApiImpl(path, options);
            },
        },
    });

    return {
        hooks,
        recorded,
        toastRecorded,
    };
}

/**
 * Loads the settings panels controller against the real dashboard settings markup.
 */
async function loadSettingsScenario({ requestApiImpl }) {
    const html = await readFile(DASHBOARD_TEMPLATE_PATH, 'utf8');
    const dom = createDom(html, 'http://localhost/dashboard');
    const restoreDom = installDomGlobals(dom);
    const sessionChanges = [];
    const requestCalls = [];
    const storedTokens = [];
    let resetCalls = 0;
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const { hooks } = await loadVmHooks({
            filePath: DASHBOARD_SETTINGS_PANELS_PATH,
            transform: transformSettingsPanelsSource,
            hookName: '__workflowSettings',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                BaseComponent,
                Form,
                Toast,
                requestApi: async (path, options = {}) => {
                    requestCalls.push({ path, options: normalizeValue(options) });
                    return requestApiImpl(path, options);
                },
                storeToken(token) {
                    storedTokens.push(token);
                },
                resetCurrentSession() {
                    resetCalls += 1;
                },
            },
        });

        const panels = new hooks.DashboardSettingsPanels({
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

/**
 * Loads the create-event modal controller with a modal stub backed by the real HTML partial.
 */
async function loadCreateEventModalScenario({ requestApiImpl }) {
    const createEventHtml = await readFile(CREATE_EVENT_MODAL_TEMPLATE_PATH, 'utf8');
    const dom = createDom('<body></body>', 'http://localhost/dashboard');
    const restoreDom = installDomGlobals(dom);
    const requestCalls = [];
    const submitDetails = [];
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const { hooks } = await loadVmHooks({
            filePath: DASHBOARD_CREATE_EVENT_MODAL_PATH,
            transform: transformCreateEventModalSource,
            hookName: '__workflowCreateEvent',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                HTMLSelectElement: dom.window.HTMLSelectElement,
                HTMLButtonElement: dom.window.HTMLButtonElement,
                Form,
                Button,
                Modal: createModalStubClass({
                    '/html/dashboard-create-event-modal.html': createEventHtml,
                }),
                Toast,
                requestApi: async (path, options = {}) => {
                    requestCalls.push({ path, options: normalizeValue(options) });
                    return requestApiImpl(path, options);
                },
                canOpenEventForm(event, options) {
                    if (event?.status === 'published' && !options?.allowAdminEdit) {
                        return false;
                    }

                    return true;
                },
                formatDateTimeLocalInputValue(value) {
                    const date = new Date(value);
                    const year = String(date.getFullYear());
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                },
                serializeDateTimeLocalInputValue,
            },
        });

        const modal = new hooks.DashboardEventFormModal();
        modal.onSubmitSuccess((detail) => {
            submitDetails.push(normalizeValue(detail));
        });

        return {
            dom,
            modal,
            requestCalls,
            submitDetails,
            toastRecorded,
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

/**
 * Loads the delete-event modal controller with a modal stub that exposes footer actions.
 */
async function loadDeleteEventModalScenario({ requestApiImpl }) {
    const dom = createDom('<body></body>', 'http://localhost/dashboard');
    const restoreDom = installDomGlobals(dom);
    const requestCalls = [];
    const deleteDetails = [];
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const { hooks } = await loadVmHooks({
            filePath: DASHBOARD_DELETE_EVENT_MODAL_PATH,
            transform: transformDeleteEventModalSource,
            hookName: '__workflowDeleteEvent',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                Modal: createModalStubClass({}),
                Toast,
                requestApi: async (path, options = {}) => {
                    requestCalls.push({ path, options: normalizeValue(options) });
                    return requestApiImpl(path, options);
                },
                canDeleteOwnEvent,
                normalizeEventStatus,
            },
        });

        const modal = new hooks.DashboardDeleteEventModal();
        modal.onDeleteSuccess((detail) => {
            deleteDetails.push(normalizeValue(detail));
        });

        return {
            dom,
            modal,
            requestCalls,
            deleteDetails,
            toastRecorded,
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

/**
 * Loads the reject-event modal controller with a modal stub backed by the real HTML partial.
 */
async function loadRejectEventModalScenario({ requestApiImpl }) {
    const rejectEventHtml = await readFile(REJECT_EVENT_MODAL_TEMPLATE_PATH, 'utf8');
    const dom = createDom('<body></body>', 'http://localhost/dashboard');
    const restoreDom = installDomGlobals(dom);
    const requestCalls = [];
    const rejectDetails = [];
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const { hooks } = await loadVmHooks({
            filePath: DASHBOARD_REJECT_EVENT_MODAL_PATH,
            transform: transformRejectEventModalSource,
            hookName: '__workflowRejectEvent',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                Form,
                Modal: createModalStubClass({
                    '/html/dashboard-reject-event-modal.html': rejectEventHtml,
                }),
                Toast,
                requestApi: async (path, options = {}) => {
                    requestCalls.push({ path, options: normalizeValue(options) });
                    return requestApiImpl(path, options);
                },
            },
        });

        const modal = new hooks.DashboardRejectEventModal();
        modal.onRejectSuccess((detail) => {
            rejectDetails.push(normalizeValue(detail));
        });

        return {
            dom,
            modal,
            requestCalls,
            rejectDetails,
            toastRecorded,
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

/**
 * Loads the dashboard page controller against the real dashboard shell.
 */
async function loadDashboardPageScenario({ session, requestApiImpl }) {
    const html = await readFile(DASHBOARD_TEMPLATE_PATH, 'utf8');
    const dom = createDom(html, 'http://localhost/dashboard');
    const restoreDom = installDomGlobals(dom);
    const requestCalls = [];
    const { recorded: toastRecorded, Toast } = createToastRecorder();
    const stubs = {
        eventForm: [],
        deleteEvent: [],
        rejectEvent: [],
        settings: [],
        headers: [],
    };

    class HeaderStub {
        constructor() {
            this.session = null;
            stubs.headers.push(this);
        }

        async getSession() {
            return session;
        }

        setSession(nextSession) {
            this.session = nextSession;
            return this;
        }
    }

    class EventFormModalStub {
        constructor() {
            this.openCalls = [];
            stubs.eventForm.push(this);
        }

        setSession(currentSession) {
            this.session = currentSession;
            return this;
        }

        onSubmitSuccess() {
            return this;
        }

        async open(options = {}) {
            this.openCalls.push(normalizeValue(options));
        }
    }

    class DeleteEventModalStub {
        constructor() {
            this.openCalls = [];
            stubs.deleteEvent.push(this);
        }

        setSession(currentSession) {
            this.session = currentSession;
            return this;
        }

        onDeleteSuccess() {
            return this;
        }

        async open(options = {}) {
            this.openCalls.push(normalizeValue(options));
        }
    }

    class RejectEventModalStub {
        constructor() {
            this.openCalls = [];
            stubs.rejectEvent.push(this);
        }

        setSession(currentSession) {
            this.session = currentSession;
            return this;
        }

        onRejectSuccess() {
            return this;
        }

        async open(options = {}) {
            this.openCalls.push(normalizeValue(options));
        }
    }

    class SettingsPanelsStub {
        constructor() {
            this.focusCalls = 0;
            this.sessionChangeHandler = null;
            stubs.settings.push(this);
        }

        setSession(currentSession) {
            this.session = currentSession;
            return this;
        }

        onSessionChange(callback) {
            this.sessionChangeHandler = callback;
            return this;
        }

        focus() {
            this.focusCalls += 1;
            return this;
        }
    }

    try {
        const { hooks } = await loadVmHooks({
            filePath: DASHBOARD_ENTRY_PATH,
            transform: transformDashboardEntrypointSource,
            hookName: '__workflowDashboard',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                HTMLButtonElement: dom.window.HTMLButtonElement,
                HTMLSelectElement: dom.window.HTMLSelectElement,
                BaseComponent,
                Button,
                Header: HeaderStub,
                DashboardActionTabs,
                DashboardEventFormModal: EventFormModalStub,
                DashboardDeleteEventModal: DeleteEventModalStub,
                DashboardRejectEventModal: RejectEventModalStub,
                DashboardSettingsPanels: SettingsPanelsStub,
                DashboardFilters,
                Pagination,
                Toast,
                Tooltip: TooltipStub,
                requestApi: async (path, options = {}) => {
                    requestCalls.push({ path, options: normalizeValue(options) });
                    return requestApiImpl(path, options);
                },
                Event,
                canDeleteOwnEvent,
                canEditOwnEvent,
                isPendingLikeEventStatus,
                createDefaultDashboardBrowseFilters,
                filterDashboardBrowseEvents,
                formatDashboardBrowseBadge,
                readDashboardBrowseCaption,
                readDashboardBrowseEmptyState,
            },
        });

        const page = new hooks.DashboardPage();
        await page.init();
        await flushMicrotasks();

        return {
            dom,
            page,
            requestCalls,
            toastRecorded,
            stubs,
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

/**
 * Loads the week entrypoint with test doubles for API and list rendering.
 */
async function loadWeekScenario({ templateVars, responseFactory }) {
    const html = await readFile(WEEK_TEMPLATE_PATH, 'utf8');
    const dom = createDom(html, 'http://localhost/week');
    const restoreDom = installDomGlobals(dom);
    const recorded = {
        requests: [],
        clears: [],
        renders: [],
        pagination: [],
    };
    const { recorded: toastRecorded, Toast } = createToastRecorder();

    try {
        const { hooks } = await loadVmHooks({
            filePath: WEEK_ENTRY_PATH,
            transform: transformWeekEntrypointSource,
            hookName: '__workflowWeek',
            context: {
                window: dom.window,
                document: dom.window.document,
                Element: dom.window.Element,
                apiClient: {
                    async request(endpoint) {
                        recorded.requests.push(endpoint);
                        return responseFactory(endpoint);
                    },
                },
                TemplateVar: {
                    get(key) {
                        return templateVars[key];
                    },
                },
                EventList: class EventListMock {
                    isReady() {
                        return true;
                    }

                    clear(options = {}) {
                        recorded.clears.push(normalizeValue(options));
                        return this;
                    }

                    render(events) {
                        recorded.renders.push(normalizeValue(events));
                        return this;
                    }
                },
                Pagination: class PaginationMock {
                    onPageChange() {
                        return this;
                    }

                    clampPage(page) {
                        return Number(page) || 1;
                    }

                    readPageItems(events) {
                        return events;
                    }

                    render(detail) {
                        recorded.pagination.push(normalizeValue(detail));
                        return this;
                    }
                },
                Toast,
                Tooltip: TooltipStub,
                getCurrentWeekRangeLocal,
            },
        });

        hooks.initWeekPage();
        await flushMicrotasks();

        return {
            dom,
            recorded,
            toastRecorded,
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

test('home filters submit every available criterion through the main-page workflow', async () => {
    const initialFilters = {
        search: '',
        category: '',
        from: '2026-04-06',
        to: '2026-04-12',
    };
    const scenario = await loadHomeScenario({
        initialFilters,
        responseFactory() {
            return {
                ok: true,
                data: {
                    events: [{ id: 'evt-1', date: '2026-04-10T14:00:00.000Z' }],
                },
            };
        },
    });

    try {
        assert.deepEqual(scenario.recorded.requests, ['/events?from=2026-04-06&to=2026-04-12']);

        scenario.recorded.applyHandler({
            search: 'seminario',
            category: '',
            from: '2026-04-06',
            to: '2026-04-12',
        });
        await flushMicrotasks();

        scenario.recorded.applyHandler({
            search: '',
            category: 'academico',
            from: '2026-04-06',
            to: '2026-04-12',
        });
        await flushMicrotasks();

        scenario.recorded.applyHandler({
            search: '',
            category: '',
            from: '2026-04-08',
            to: '2026-04-10',
        });
        await flushMicrotasks();

        scenario.recorded.applyHandler({
            search: 'mostra',
            category: 'extensao',
            from: '2026-04-08',
            to: '2026-04-10',
        });
        await flushMicrotasks();

        assert.deepEqual(scenario.recorded.requests, [
            '/events?from=2026-04-06&to=2026-04-12',
            '/events?search=seminario&from=2026-04-06&to=2026-04-12',
            '/events?category=academico&from=2026-04-06&to=2026-04-12',
            '/events?from=2026-04-08&to=2026-04-10',
            '/events?search=mostra&category=extensao&from=2026-04-08&to=2026-04-10',
        ]);
        assert.equal(scenario.recorded.hydratedFilters.length, 1);
    } finally {
        scenario.restore();
    }
});

test('login workflow authenticates existing users and falls back to the dashboard for unsafe redirect targets', async () => {
    const scenario = await loadLoginScenario({
        templateRedirect: '//evil.example',
        search: '?redirect=/dashboard?view=settings',
        requestApiImpl() {
            return {
                ok: true,
                data: {
                    token: 'jwt-login-token',
                },
            };
        },
    });

    await scenario.hooks.submitLogin({
        form: {},
        values: {
            email: 'membro@ifsul.edu.br',
            password: 'senha-segura',
        },
    });

    assert.deepEqual(scenario.recorded.requests, [{
        path: '/auth/login',
        options: {
            method: 'POST',
            body: {
                email: 'membro@ifsul.edu.br',
                password: 'senha-segura',
            },
        },
    }]);
    assert.equal(scenario.recorded.storedToken, 'jwt-login-token');
    assert.equal(scenario.recorded.assignedTarget, '/dashboard');
    assert.equal(scenario.toastRecorded.flashes.at(-1)?.text, 'Login realizado com sucesso.');
});

test('auth redirect helper keeps only safe internal dashboard targets', async () => {
    const safeTemplateScenario = await loadLoginScenario({
        templateRedirect: '/dashboard?view=settings',
        requestApiImpl() {
            throw new Error('requestApi should not be called when testing redirect resolution.');
        },
    });
    const safeQueryScenario = await loadLoginScenario({
        search: '?redirect=/dashboard?view=settings',
        requestApiImpl() {
            throw new Error('requestApi should not be called when testing redirect resolution.');
        },
    });
    const unsafeLoginScenario = await loadLoginScenario({
        templateRedirect: '/login?redirect=/dashboard',
        requestApiImpl() {
            throw new Error('requestApi should not be called when testing redirect resolution.');
        },
    });

    assert.equal(safeTemplateScenario.hooks.readRedirectTarget(), '/dashboard?view=settings');
    assert.equal(safeQueryScenario.hooks.readRedirectTarget(), '/dashboard?view=settings');
    assert.equal(unsafeLoginScenario.hooks.readRedirectTarget(), '/dashboard');
});

test('register workflow validates required fields and confirmation before starting the new session', async () => {
    const scenario = await loadLoginScenario({
        templateRedirect: '/dashboard',
        requestApiImpl(_path, options) {
            if (options?.body?.email === 'novo@ifsul.edu.br') {
                return {
                    ok: true,
                    data: {
                        token: 'jwt-register-token',
                    },
                };
            }

            return {
                ok: false,
                message: 'Falha inesperada.',
            };
        },
    });
    const focusedFields = [];
    const form = {
        getField(fieldName) {
            return {
                focus() {
                    focusedFields.push(fieldName);
                },
            };
        },
    };

    await scenario.hooks.submitRegister({
        form,
        values: {
            name: '',
            email: 'novo@ifsul.edu.br',
            password: 'abc123',
            confirmPassword: 'abc123',
        },
    });

    assert.equal(scenario.recorded.requests.length, 0);
    assert.equal(scenario.toastRecorded.shows.at(-1)?.text, 'Preencha nome, e-mail e senha para continuar.');

    await scenario.hooks.submitRegister({
        form,
        values: {
            name: 'Novo Usuario',
            email: 'novo@ifsul.edu.br',
            password: 'abc123',
            confirmPassword: 'xyz987',
        },
    });

    assert.equal(scenario.recorded.requests.length, 0);
    assert.equal(focusedFields.at(-1), 'confirmPassword');
    assert.equal(scenario.toastRecorded.shows.at(-1)?.text, 'A confirmação de senha não confere.');

    await scenario.hooks.submitRegister({
        form,
        values: {
            name: 'Novo Usuario',
            email: 'novo@ifsul.edu.br',
            password: 'abc123',
            confirmPassword: 'abc123',
        },
    });

    assert.deepEqual(scenario.recorded.requests.at(-1), {
        path: '/auth/register',
        options: {
            method: 'POST',
            body: {
                name: 'Novo Usuario',
                email: 'novo@ifsul.edu.br',
                password: 'abc123',
            },
        },
    });
    assert.equal(scenario.recorded.storedToken, 'jwt-register-token');
    assert.equal(scenario.recorded.assignedTarget, '/dashboard');
    assert.equal(scenario.toastRecorded.flashes.at(-1)?.text, 'Conta criada com sucesso. Redirecionando...');
});

test('dashboard member workflow renders visible event metadata, dispatches rejected-owner actions, and navigates create/settings tabs', async () => {
    const rejectedEvent = {
        id: 'evt-rejected',
        title: 'Evento Rejeitado',
        description: 'Precisa de ajustes.',
        date: '2026-04-12T14:00:00.000Z',
        category: 'academico',
        location: 'Sala 3',
        status: 'rejected',
        rejectionReason: 'Inclua mais detalhes sobre o publico.',
    };
    const publishedEvent = {
        id: 'evt-published',
        title: 'Evento Publicado',
        description: 'Ja esta visivel.',
        date: '2026-04-14T14:00:00.000Z',
        category: 'extensao',
        location: 'Auditorio',
        status: 'published',
    };
    const scenario = await loadDashboardPageScenario({
        session: {
            isAuthenticated: true,
            token: 'member-token',
            user: {
                id: 'member-1',
                name: 'Maria',
                email: 'maria@ifsul.edu.br',
                role: 'member',
            },
        },
        requestApiImpl(path) {
            if (path === '/events/mine') {
                return {
                    ok: true,
                    data: {
                        events: [rejectedEvent, publishedEvent],
                    },
                };
            }

            throw new Error(`Unexpected request path: ${path}`);
        },
    });

    try {
        const { document } = scenario.dom.window;
        const rejectedCard = document.querySelector('[data-event-id="evt-rejected"]');
        const publishedCard = document.querySelector('[data-event-id="evt-published"]');

        assert.equal(document.querySelector('#dashboard-action-tab-moderation').hidden, true);
        assert.equal(document.querySelectorAll('#dashboard-events-list .dashboard-event').length, 2);
        assert.ok(rejectedCard);
        assert.ok(publishedCard);
        assert.match(rejectedCard.querySelector('.dashboard-event__title').textContent, /Evento Rejeitado/);
        assert.match(rejectedCard.querySelector('.dashboard-event__description').textContent, /Precisa de ajustes/);
        assert.match(rejectedCard.querySelector('.dashboard-status-pill--warning').textContent, /Rejeitado/);
        assert.equal(rejectedCard.querySelectorAll('.dashboard-status-pill').length, 2);
        assert.match(rejectedCard.querySelector('.dashboard-meta-pill--category').textContent, new RegExp(Event.from(rejectedEvent).readCategoryMeta().label));
        assert.match(rejectedCard.querySelector('.dashboard-meta-pill--location').textContent, /Sala 3/);
        assert.equal(
            rejectedCard.querySelector('.dashboard-meta-pill--date').textContent.includes(Event.from(rejectedEvent).formatDateTimePtBr()),
            true,
        );
        assert.match(rejectedCard.querySelector('.dashboard-event__feedback-text').textContent, /Inclua mais detalhes/);

        assert.match(publishedCard.querySelector('.dashboard-event__title').textContent, /Evento Publicado/);
        assert.match(publishedCard.querySelector('.dashboard-event__description').textContent, /Ja esta visivel/);
        assert.match(publishedCard.querySelector('.dashboard-status-pill--success').textContent, /Publicado/);
        assert.match(publishedCard.querySelector('.dashboard-meta-pill--category').textContent, new RegExp(Event.from(publishedEvent).readCategoryMeta().label));
        assert.match(publishedCard.querySelector('.dashboard-meta-pill--location').textContent, /Auditorio/);

        const rejectedActionNames = Array.from(rejectedCard.querySelectorAll('[data-dashboard-action]'))
            .map(button => button.dataset.dashboardAction);
        assert.deepEqual(rejectedActionNames, ['edit', 'delete']);

        const publishedActionNames = Array.from(publishedCard.querySelectorAll('[data-dashboard-action]'))
            .map(button => button.dataset.dashboardAction);
        assert.deepEqual(publishedActionNames, []);

        await clickElement(scenario.dom, '[data-event-id="evt-rejected"] [data-dashboard-action="edit"]');
        assert.deepEqual(scenario.stubs.eventForm[0].openCalls.at(-1), {
            event: rejectedEvent,
        });

        await clickElement(scenario.dom, '[data-event-id="evt-rejected"] [data-dashboard-action="delete"]');
        assert.deepEqual(scenario.stubs.deleteEvent[0].openCalls.at(-1), {
            event: rejectedEvent,
        });

        await clickElement(scenario.dom, '#dashboard-action-tab-settings');
        assert.equal(document.querySelector('#dashboard-settings-section').hidden, false);
        assert.equal(document.querySelector('#dashboard-events-section').hidden, true);
        assert.equal(scenario.stubs.settings[0].focusCalls, 1);

        await clickElement(scenario.dom, '#dashboard-action-tab-browse');
        assert.equal(document.querySelector('#dashboard-settings-section').hidden, true);
        assert.equal(document.querySelector('#dashboard-events-section').hidden, false);
        assert.equal(document.querySelector('#dashboard-overview-section').hidden, false);

        await clickElement(scenario.dom, '#dashboard-action-tab-create');
        assert.equal(scenario.stubs.eventForm[0].openCalls.length, 2);
        assert.deepEqual(scenario.stubs.eventForm[0].openCalls.at(-1), {});
    } finally {
        scenario.restore();
    }
});

test('settings panels update profile, password, and email preferences through the dashboard workflow', async () => {
    const scenario = await loadSettingsScenario({
        requestApiImpl(path, options) {
            if (path === '/auth/me') {
                return {
                    ok: true,
                    message: 'Perfil atualizado.',
                    data: {
                        token: 'updated-token',
                        user: {
                            id: 'member-1',
                            name: options.body.name,
                            email: options.body.email,
                            role: 'member',
                            emailPreferences: {
                                eventUpdates: true,
                            },
                        },
                    },
                };
            }

            if (path === '/auth/password') {
                return {
                    ok: true,
                    message: 'Senha atualizada.',
                    data: {},
                };
            }

            if (path === '/auth/me/preferences') {
                return {
                    ok: true,
                    message: 'Preferencias atualizadas.',
                    data: {
                        token: 'updated-token-2',
                        user: {
                            id: 'member-1',
                            name: 'Maria Silva',
                            email: 'maria.silva@ifsul.edu.br',
                            role: 'member',
                            emailPreferences: options.body.emailPreferences,
                        },
                    },
                };
            }

            throw new Error(`Unexpected request path: ${path}`);
        },
    });

    try {
        scenario.panels.setSession({
            isAuthenticated: true,
            token: 'member-token',
            user: {
                id: 'member-1',
                name: 'Maria',
                email: 'maria@ifsul.edu.br',
                role: 'member',
                emailPreferences: {
                    eventUpdates: true,
                },
            },
        });

        const { document } = scenario.dom.window;
        document.querySelector('#dashboard-settings-name').value = 'Maria Silva';
        document.querySelector('#dashboard-settings-email').value = 'maria.silva@ifsul.edu.br';
        await submitForm(scenario.dom, '#dashboard-settings-profile-form');

        document.querySelector('#dashboard-settings-current-password').value = 'senha-atual';
        document.querySelector('#dashboard-settings-new-password').value = 'senha-atual';
        document.querySelector('#dashboard-settings-confirm-password').value = 'senha-atual';
        await submitForm(scenario.dom, '#dashboard-settings-password-form');

        document.querySelector('#dashboard-settings-new-password').value = 'nova-senha';
        document.querySelector('#dashboard-settings-confirm-password').value = 'nova-senha';
        await submitForm(scenario.dom, '#dashboard-settings-password-form');

        document.querySelector('#dashboard-settings-email-event-updates').checked = false;
        await submitForm(scenario.dom, '#dashboard-settings-preferences-form');

        assert.deepEqual(scenario.requestCalls, [
            {
                path: '/auth/me',
                options: {
                    method: 'PUT',
                    token: 'member-token',
                    body: {
                        name: 'Maria Silva',
                        email: 'maria.silva@ifsul.edu.br',
                    },
                },
            },
            {
                path: '/auth/password',
                options: {
                    method: 'PUT',
                    token: 'updated-token',
                    body: {
                        currentPassword: 'senha-atual',
                        newPassword: 'nova-senha',
                    },
                },
            },
            {
                path: '/auth/me/preferences',
                options: {
                    method: 'PUT',
                    token: 'updated-token',
                    body: {
                        emailPreferences: {
                            eventUpdates: false,
                        },
                    },
                },
            },
        ]);
        assert.deepEqual(scenario.storedTokens, ['updated-token', 'updated-token-2']);
        assert.equal(scenario.readResetCalls(), 2);
        assert.equal(scenario.sessionChanges.length, 2);
        assert.equal(scenario.toastRecorded.shows.at(-1)?.text, 'Preferencias atualizadas.');
        assert.equal(scenario.toastRecorded.shows.some(call => call.text === 'A nova senha precisa ser diferente da senha atual.'), true);
    } finally {
        scenario.restore();
    }
});

test('admin settings panels reset passwords and promote users through the dashboard tools', async () => {
    const scenario = await loadSettingsScenario({
        requestApiImpl(path, options) {
            if (path === '/auth/users/password/reset') {
                return {
                    ok: true,
                    message: 'Senha redefinida.',
                    data: {},
                };
            }

            if (path === '/auth/users') {
                return {
                    ok: true,
                    data: {
                        users: [
                            {
                                id: 'member-2',
                                name: 'Joao',
                                email: 'joao@ifsul.edu.br',
                                role: 'member',
                            },
                        ],
                    },
                };
            }

            if (path === '/auth/users/member-2/promote') {
                return {
                    ok: true,
                    message: 'Usuario promovido.',
                    data: {},
                };
            }

            throw new Error(`Unexpected request path: ${path}`);
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
                    adminPendingRequests: true,
                },
            },
        });

        const { document } = scenario.dom.window;
        document.querySelector('#dashboard-settings-admin-reset-email').value = 'joao@ifsul.edu.br';
        document.querySelector('#dashboard-settings-admin-reset-password').value = 'nova-senha-admin';
        await submitForm(scenario.dom, '#dashboard-settings-admin-reset-form');

        document.querySelector('#dashboard-settings-admin-promote-email').value = 'joao@ifsul.edu.br';
        await submitForm(scenario.dom, '#dashboard-settings-admin-promote-form');

        assert.deepEqual(scenario.requestCalls, [
            {
                path: '/auth/users/password/reset',
                options: {
                    method: 'PUT',
                    token: 'admin-token',
                    body: {
                        email: 'joao@ifsul.edu.br',
                        newPassword: 'nova-senha-admin',
                    },
                },
            },
            {
                path: '/auth/users',
                options: {
                    token: 'admin-token',
                },
            },
            {
                path: '/auth/users/member-2/promote',
                options: {
                    method: 'PUT',
                    token: 'admin-token',
                },
            },
        ]);
        assert.equal(scenario.toastRecorded.shows.at(-1)?.text, 'Usuario promovido.');
    } finally {
        scenario.restore();
    }
});

test('event form modal covers create, validation, blocked edit, and edit resubmission workflows', async () => {
    const scenario = await loadCreateEventModalScenario({
        requestApiImpl(path, options) {
            return {
                ok: true,
                message: path === '/events' ? 'Evento enviado.' : 'Evento atualizado.',
                data: {
                    event: {
                        id: path === '/events' ? 'evt-new' : 'evt-edit',
                        ...options.body,
                        status: 'pending',
                    },
                },
            };
        },
    });

    try {
        scenario.modal.setSession({ token: 'member-token' });
        await scenario.modal.open();

        const { document } = scenario.dom.window;
        document.querySelector('#dashboard-modal-event-title').value = '';
        document.querySelector('#dashboard-modal-event-description').value = '';
        document.querySelector('#dashboard-modal-event-date').value = '';
        await submitForm(scenario.dom, '#dashboard-modal-create-form');

        assert.equal(scenario.requestCalls.length, 0);
        assert.equal(scenario.toastRecorded.shows.at(-1)?.text, 'Preencha título, descrição e data antes de enviar o evento.');

        await scenario.modal.open();
        document.querySelector('#dashboard-modal-event-title').value = 'Semana Academica';
        document.querySelector('#dashboard-modal-event-description').value = 'Programacao completa.';
        document.querySelector('#dashboard-modal-event-date').value = '2026-04-15T19:30';
        document.querySelector('#dashboard-modal-event-category').value = '';
        document.querySelector('#dashboard-modal-event-location').value = '';
        await submitForm(scenario.dom, '#dashboard-modal-create-form');

        await scenario.modal.open({
            event: {
                id: 'evt-published',
                status: 'published',
                title: 'Publicado',
            },
        });

        await scenario.modal.open({
            event: {
                id: 'evt-edit',
                status: 'rejected',
                title: 'Feira antiga',
                description: 'Descricao antiga.',
                date: '2026-04-18T13:00:00.000Z',
                category: 'reuniao',
                location: 'Sala 1',
            },
        });
        document.querySelector('#dashboard-modal-event-title').value = 'Feira atualizada';
        document.querySelector('#dashboard-modal-event-description').value = 'Descricao nova.';
        document.querySelector('#dashboard-modal-event-date').value = '2026-04-19T09:15';
        document.querySelector('#dashboard-modal-event-category').value = 'extensao';
        document.querySelector('#dashboard-modal-event-location').value = 'Patio';
        await submitForm(scenario.dom, '#dashboard-modal-create-form');

        assert.deepEqual(scenario.requestCalls, [
            {
                path: '/events',
                options: {
                    method: 'POST',
                    token: 'member-token',
                    body: {
                        title: 'Semana Academica',
                        description: 'Programacao completa.',
                        date: serializeDateTimeLocalInputValue('2026-04-15T19:30'),
                        category: 'outro',
                        location: 'A definir',
                    },
                },
            },
            {
                path: '/events/evt-edit',
                options: {
                    method: 'PUT',
                    token: 'member-token',
                    body: {
                        title: 'Feira atualizada',
                        description: 'Descricao nova.',
                        date: serializeDateTimeLocalInputValue('2026-04-19T09:15'),
                        category: 'extensao',
                        location: 'Patio',
                    },
                },
            },
        ]);
        assert.equal(scenario.submitDetails.length, 2);
        assert.equal(scenario.submitDetails[0].mode, 'create');
        assert.equal(scenario.submitDetails[1].mode, 'edit');
        assert.equal(scenario.submitDetails[1].previousEventId, 'evt-edit');
        assert.equal(scenario.toastRecorded.shows.some(call => call.text === 'Apenas eventos pendentes ou rejeitados podem ser editados por aqui.'), true);
    } finally {
        scenario.restore();
    }
});

test('dashboard admin moderation workflow dispatches queue actions, approves pending events, and routes discovery admin actions to shared modals', async () => {
    const pendingEvent = {
        id: 'evt-pending',
        title: 'Envio pendente',
        description: 'Aguardando analise.',
        date: '2026-04-16T14:00:00.000Z',
        category: 'academico',
        location: 'Sala 2',
        organizerId: 'member-2',
        organizerName: 'Joao',
        status: 'pending',
    };
    const rejectedDiscoveryEvent = {
        id: 'evt-rejected-other',
        title: 'Rejeitado de outra conta',
        description: 'Precisa de ajustes administrativos.',
        date: '2026-04-17T14:00:00.000Z',
        category: 'reuniao',
        location: 'Laboratorio 5',
        organizerId: 'member-8',
        organizerName: 'Ana',
        status: 'rejected',
        rejectionReason: 'Atualize o publico-alvo.',
    };
    const publishedDiscoveryEvent = {
        id: 'evt-published-other',
        title: 'Publicado de outra conta',
        description: 'Ja esta na agenda.',
        date: '2026-04-18T14:00:00.000Z',
        category: 'extensao',
        location: 'Auditorio',
        organizerId: 'member-9',
        organizerName: 'Carlos',
        status: 'published',
    };
    const scenario = await loadDashboardPageScenario({
        session: {
            isAuthenticated: true,
            token: 'admin-token',
            user: {
                id: 'admin-1',
                name: 'Admin',
                email: 'admin@ifsul.edu.br',
                role: 'admin',
            },
        },
        requestApiImpl(path, options) {
            if (path === '/events/mine') {
                return {
                    ok: true,
                    data: {
                        events: [],
                    },
                };
            }

            if (path === '/events/moderation?status=pending') {
                return {
                    ok: true,
                    data: {
                        events: [pendingEvent],
                    },
                };
            }

            if (path === '/events/moderation?status=rejected') {
                return {
                    ok: true,
                    data: {
                        events: [rejectedDiscoveryEvent],
                    },
                };
            }

            if (path === '/events/evt-pending/moderation' && options?.method === 'PUT') {
                return {
                    ok: true,
                    message: 'Evento aprovado e publicado.',
                    data: {
                        event: {
                            id: 'evt-pending',
                            title: 'Envio pendente',
                            status: 'published',
                            date: '2026-04-16T14:00:00.000Z',
                        },
                    },
                };
            }

            if (path === '/events') {
                return {
                    ok: true,
                    data: {
                        events: [publishedDiscoveryEvent],
                    },
                };
            }

            throw new Error(`Unexpected request path: ${path}`);
        },
    });

    try {
        const { document } = scenario.dom.window;
        assert.equal(document.querySelector('#dashboard-action-tab-moderation').hidden, false);

        await clickElement(scenario.dom, '#dashboard-action-tab-moderation');

        assert.equal(scenario.requestCalls.some(call => call.path === '/events/moderation?status=pending'), true);
        const moderationActions = Array.from(document.querySelectorAll('[data-event-id="evt-pending"] [data-dashboard-action]'))
            .map(button => button.dataset.dashboardAction);
        assert.deepEqual(moderationActions, ['edit', 'approve', 'reject', 'delete']);

        await clickElement(scenario.dom, '[data-event-id="evt-pending"] [data-dashboard-action="edit"]');
        assert.deepEqual(scenario.stubs.eventForm[0].openCalls.at(-1), {
            event: pendingEvent,
            allowAdminEdit: true,
        });

        await clickElement(scenario.dom, '[data-event-id="evt-pending"] [data-dashboard-action="reject"]');
        assert.deepEqual(scenario.stubs.rejectEvent[0].openCalls.at(-1), {
            event: pendingEvent,
        });

        await clickElement(scenario.dom, '[data-event-id="evt-pending"] [data-dashboard-action="delete"]');
        assert.deepEqual(scenario.stubs.deleteEvent[0].openCalls.at(-1), {
            event: pendingEvent,
            allowAdminDelete: true,
        });

        await clickElement(scenario.dom, '[data-event-id="evt-pending"] [data-dashboard-action="approve"]');

        assert.equal(scenario.requestCalls.some((call) => call.path === '/events/evt-pending/moderation' && call.options.body?.status === 'published'), true);
        assert.equal(document.querySelectorAll('#dashboard-events-list .dashboard-event').length, 0);

        const scopeField = document.querySelector('#dashboard-events-filter-moderation-scope');
        scopeField.value = 'rejected';
        scopeField.dispatchEvent(new scenario.dom.window.Event('change', { bubbles: true }));
        await flushMicrotasks();

        assert.equal(scenario.requestCalls.some(call => call.path === '/events/moderation?status=rejected'), true);
        const rejectedDiscoveryActions = Array.from(document.querySelectorAll('[data-event-id="evt-rejected-other"] [data-dashboard-action]'))
            .map(button => button.dataset.dashboardAction);
        assert.deepEqual(rejectedDiscoveryActions, ['edit', 'delete']);

        await clickElement(scenario.dom, '[data-event-id="evt-rejected-other"] [data-dashboard-action="edit"]');
        assert.deepEqual(scenario.stubs.eventForm[0].openCalls.at(-1), {
            event: rejectedDiscoveryEvent,
            allowAdminEdit: true,
        });

        await clickElement(scenario.dom, '[data-event-id="evt-rejected-other"] [data-dashboard-action="delete"]');
        assert.deepEqual(scenario.stubs.deleteEvent[0].openCalls.at(-1), {
            event: rejectedDiscoveryEvent,
            allowAdminDelete: true,
        });

        scopeField.value = 'published';
        scopeField.dispatchEvent(new scenario.dom.window.Event('change', { bubbles: true }));
        await flushMicrotasks();

        assert.equal(scenario.requestCalls.some(call => call.path === '/events'), true);
        const discoveryActions = Array.from(document.querySelectorAll('[data-event-id="evt-published-other"] [data-dashboard-action]'))
            .map(button => button.dataset.dashboardAction);
        assert.deepEqual(discoveryActions, ['edit', 'delete']);

        await clickElement(scenario.dom, '[data-event-id="evt-published-other"] [data-dashboard-action="edit"]');
        await clickElement(scenario.dom, '[data-event-id="evt-published-other"] [data-dashboard-action="delete"]');

        assert.deepEqual(scenario.stubs.eventForm[0].openCalls.at(-1), {
            event: publishedDiscoveryEvent,
            allowAdminEdit: true,
        });
        assert.deepEqual(scenario.stubs.deleteEvent[0].openCalls.at(-1), {
            event: publishedDiscoveryEvent,
            allowAdminDelete: true,
        });
    } finally {
        scenario.restore();
    }
});

test('admin discovery event-form modal submits rejected and published edits through the shared admin branch', async () => {
    const rejectedDiscoveryEvent = {
        id: 'evt-rejected-other',
        title: 'Rejeitado de outra conta',
        description: 'Precisa de ajustes administrativos.',
        date: '2026-04-17T14:00:00.000Z',
        category: 'reuniao',
        location: 'Laboratorio 5',
        organizerId: 'member-8',
        organizerName: 'Ana',
        status: 'rejected',
        rejectionReason: 'Atualize o publico-alvo.',
    };
    const publishedDiscoveryEvent = {
        id: 'evt-published-other',
        title: 'Publicado de outra conta',
        description: 'Ja esta na agenda.',
        date: '2026-04-18T14:00:00.000Z',
        category: 'extensao',
        location: 'Auditorio',
        organizerId: 'member-9',
        organizerName: 'Carlos',
        status: 'published',
    };
    const scenario = await loadCreateEventModalScenario({
        requestApiImpl(path, options) {
            return {
                ok: true,
                message: 'Evento atualizado e enviado para moderação.',
                data: {
                    event: {
                        id: path.split('/').at(-1),
                        ...options.body,
                        status: 'pending',
                    },
                },
            };
        },
    });

    try {
        scenario.modal.setSession({ token: 'admin-token' });

        await scenario.modal.open({
            event: rejectedDiscoveryEvent,
            allowAdminEdit: true,
        });

        const { document } = scenario.dom.window;
        document.querySelector('#dashboard-modal-event-title').value = 'Rejeitado revisado';
        document.querySelector('#dashboard-modal-event-description').value = 'Ajustes administrativos concluídos.';
        document.querySelector('#dashboard-modal-event-date').value = '2026-04-19T09:30';
        document.querySelector('#dashboard-modal-event-category').value = 'academico';
        document.querySelector('#dashboard-modal-event-location').value = 'Sala 7';
        await submitForm(scenario.dom, '#dashboard-modal-create-form');

        await scenario.modal.open({
            event: publishedDiscoveryEvent,
            allowAdminEdit: true,
        });

        assert.equal(document.querySelector('#dashboard-modal-event-title').value, 'Publicado de outra conta');
        document.querySelector('#dashboard-modal-event-title').value = 'Publicado ajustado';
        document.querySelector('#dashboard-modal-event-description').value = 'Voltando para moderação administrativa.';
        document.querySelector('#dashboard-modal-event-date').value = '2026-04-20T10:45';
        document.querySelector('#dashboard-modal-event-category').value = 'extensao';
        document.querySelector('#dashboard-modal-event-location').value = 'Auditorio central';
        await submitForm(scenario.dom, '#dashboard-modal-create-form');

        assert.deepEqual(scenario.requestCalls, [
            {
                path: '/events/evt-rejected-other',
                options: {
                    method: 'PUT',
                    token: 'admin-token',
                    body: {
                        title: 'Rejeitado revisado',
                        description: 'Ajustes administrativos concluídos.',
                        date: serializeDateTimeLocalInputValue('2026-04-19T09:30'),
                        category: 'academico',
                        location: 'Sala 7',
                    },
                },
            },
            {
                path: '/events/evt-published-other',
                options: {
                    method: 'PUT',
                    token: 'admin-token',
                    body: {
                        title: 'Publicado ajustado',
                        description: 'Voltando para moderação administrativa.',
                        date: serializeDateTimeLocalInputValue('2026-04-20T10:45'),
                        category: 'extensao',
                        location: 'Auditorio central',
                    },
                },
            },
        ]);
        assert.deepEqual(scenario.submitDetails.map(detail => detail.mode), ['edit', 'edit']);
        assert.deepEqual(scenario.submitDetails.map(detail => detail.previousEventId), ['evt-rejected-other', 'evt-published-other']);
    } finally {
        scenario.restore();
    }
});

test('admin discovery delete modal confirms rejected and published deletions through the shared admin branch', async () => {
    const rejectedDiscoveryEvent = {
        id: 'evt-rejected-other',
        title: 'Rejeitado de outra conta',
        status: 'rejected',
        organizerId: 'member-8',
    };
    const publishedDiscoveryEvent = {
        id: 'evt-published-other',
        title: 'Publicado de outra conta',
        status: 'published',
        organizerId: 'member-9',
    };
    const scenario = await loadDeleteEventModalScenario({
        requestApiImpl() {
            return {
                ok: true,
                message: 'Evento excluído.',
                data: {},
            };
        },
    });

    try {
        scenario.modal.setSession({ token: 'admin-token' });

        await scenario.modal.open({
            event: rejectedDiscoveryEvent,
            allowAdminDelete: true,
        });
        assert.match(
            scenario.dom.window.document.querySelector('#dashboard-delete-event-modal').textContent,
            /Status atual:\s*Rejeitado/,
        );
        await clickElement(scenario.dom, '#dashboard-delete-confirm');

        await scenario.modal.open({
            event: publishedDiscoveryEvent,
            allowAdminDelete: true,
        });
        assert.match(
            scenario.dom.window.document.querySelector('#dashboard-delete-event-modal').textContent,
            /Status atual:\s*Publicado/,
        );
        await clickElement(scenario.dom, '#dashboard-delete-confirm');

        assert.deepEqual(scenario.requestCalls, [
            {
                path: '/events/evt-rejected-other',
                options: {
                    method: 'DELETE',
                    token: 'admin-token',
                },
            },
            {
                path: '/events/evt-published-other',
                options: {
                    method: 'DELETE',
                    token: 'admin-token',
                },
            },
        ]);
        assert.deepEqual(scenario.deleteDetails.map(detail => detail.eventId), ['evt-rejected-other', 'evt-published-other']);
    } finally {
        scenario.restore();
    }
});

test('reject-event modal submits a moderation reason for administrators', async () => {
    const scenario = await loadRejectEventModalScenario({
        requestApiImpl(_path, options) {
            return {
                ok: true,
                message: 'Evento rejeitado.',
                data: {
                    event: {
                        id: 'evt-reject',
                        status: 'rejected',
                        rejectionReason: options.body.rejectionReason,
                    },
                },
            };
        },
    });

    try {
        scenario.modal.setSession({ token: 'admin-token' });
        await scenario.modal.open({
            event: {
                id: 'evt-reject',
                title: 'Seminario sem detalhes',
            },
        });

        scenario.dom.window.document.querySelector('#dashboard-modal-reject-reason').value = 'Explique melhor o publico-alvo e o local.';
        await submitForm(scenario.dom, '#dashboard-modal-reject-form');

        assert.deepEqual(scenario.requestCalls, [{
            path: '/events/evt-reject/moderation',
            options: {
                method: 'PUT',
                token: 'admin-token',
                body: {
                    status: 'rejected',
                    rejectionReason: 'Explique melhor o publico-alvo e o local.',
                },
            },
        }]);
        assert.equal(scenario.rejectDetails.at(-1)?.event?.rejectionReason, 'Explique melhor o publico-alvo e o local.');
    } finally {
        scenario.restore();
    }
});

test('dashboard browse filters cover status, category, past visibility, and ordering for user event lists', () => {
    const events = [
        {
            id: 'evt-past-published',
            title: 'Publicado passado',
            status: 'published',
            category: 'academico',
            date: '2026-04-01T12:00:00.000Z',
        },
        {
            id: 'evt-future-rejected',
            title: 'Rejeitado futuro',
            status: 'rejected',
            category: 'extensao',
            date: '2026-04-20T12:00:00.000Z',
        },
        {
            id: 'evt-future-pending',
            title: 'Pendente futuro',
            status: 'pending',
            category: 'academico',
            date: '2026-04-18T12:00:00.000Z',
        },
    ];

    const rejectedOnly = filterDashboardBrowseEvents(events, {
        status: 'rejected',
        category: 'all',
        includePast: false,
        order: 'desc',
    }).map(event => event.id);
    const academicWithPastAsc = filterDashboardBrowseEvents(events, {
        status: 'all',
        category: 'academico',
        includePast: true,
        order: 'asc',
    }).map(event => event.id);

    assert.deepEqual(rejectedOnly, ['evt-future-rejected']);
    assert.deepEqual(academicWithPastAsc, ['evt-past-published', 'evt-future-pending']);
});

test('week page workflow loads the current range and covers populated, empty, and error states', async () => {
    const templateVars = {
        weekFrom: '2026-04-12',
        weekTo: '2026-04-18',
    };
    const responses = [
        {
            ok: true,
            data: {
                events: [{ id: 'evt-week-1', date: '2026-04-15T18:00:00.000Z' }],
            },
        },
        {
            ok: true,
            data: {
                events: [],
            },
        },
        {
            ok: false,
            message: 'Falha ao carregar agenda semanal.',
            data: null,
        },
    ];
    const scenario = await loadWeekScenario({
        templateVars,
        responseFactory() {
            return responses.shift();
        },
    });

    try {
        assert.deepEqual(scenario.recorded.requests, ['/events?from=2026-04-12&to=2026-04-18']);
        assert.equal(scenario.recorded.renders.length, 1);
        assert.match(scenario.dom.window.document.querySelector('#week-range-label').textContent, /12 de abril de 2026 a 18 de abril de 2026/);

        scenario.restore();
    } catch (error) {
        scenario.restore();
        throw error;
    }

    const emptyScenario = await loadWeekScenario({
        templateVars,
        responseFactory() {
            return {
                ok: true,
                data: {
                    events: [],
                },
            };
        },
    });

    try {
        assert.deepEqual(emptyScenario.recorded.clears.at(-1), {
            emptyMessage: 'Nenhum evento aprovado está programado para esta semana.',
            showEmptyState: true,
        });
    } finally {
        emptyScenario.restore();
    }

    const errorScenario = await loadWeekScenario({
        templateVars,
        responseFactory() {
            return {
                ok: false,
                message: 'Falha ao carregar agenda semanal.',
                data: null,
            };
        },
    });

    try {
        assert.deepEqual(errorScenario.recorded.clears.at(-1), {
            showEmptyState: false,
        });
        assert.equal(errorScenario.toastRecorded.shows.at(-1)?.text, 'Não foi possível carregar os eventos desta semana no momento.');
    } finally {
        errorScenario.restore();
    }
});