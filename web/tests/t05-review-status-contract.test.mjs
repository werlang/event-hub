import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import {
    canDeleteOwnEvent,
    canEditOwnEvent,
    canManageOwnEvent,
    canOpenEventForm,
    formatDateTimeLocalInputValue,
    isPendingLikeEventStatus,
    normalizeEventStatus,
    serializeDateTimeLocalInputValue,
} from '../src/js/dashboard/event-management.js';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const DASHBOARD_ENTRY_PATH = path.join(WEB_ROOT, 'src/js/dashboard.js');
const DASHBOARD_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/dashboard.html');
const DASHBOARD_CREATE_EVENT_MODAL_PATH = path.join(WEB_ROOT, 'src/js/dashboard/create-event-modal.js');

/**
 * Removes ESM import declarations so the dashboard entry can run inside a VM with mocks.
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
 * Rewrites the dashboard entry source into a callable script with focused T05 hooks.
 */
function transformDashboardEntrypointSource(source) {
    return stripImports(source)
        .replace(/\nnew DashboardPage\(\)\.init\(\);\s*$/, '\n')
    .concat('\nglobalThis.__t05 = { readModerationEventActionDefinitions, handleModerationQueueActionRequest, readModerationEventSourcePath, filterAdminPublishedDiscoveryEvents, filterAdminRejectedDiscoveryEvents, syncModerationEventsAfterAdminEdit };\n');
}

/**
 * Loads the dashboard entrypoint into a VM and returns the focused helper hooks.
 */
async function loadDashboardHooks() {
    const source = await readFile(DASHBOARD_ENTRY_PATH, 'utf8');
    const script = transformDashboardEntrypointSource(source);
    const context = vm.createContext({
        BaseComponent: class BaseComponent {},
        Event: {
            sortByDateDescending(events = []) {
                return [...events].sort((left, right) => new Date(right?.date || 0) - new Date(left?.date || 0));
            },
        },
        isPendingLikeEventStatus(eventOrStatus) {
            const normalizedStatus = typeof eventOrStatus === 'string'
                ? String(eventOrStatus || '').trim().toLowerCase()
                : String(eventOrStatus?.status || '').trim().toLowerCase();

            return normalizedStatus === 'pending';
        },
        console,
    });

    context.globalThis = context;
    vm.runInContext(script, context, { filename: DASHBOARD_ENTRY_PATH });

    return context.__t05;
}

/**
 * Converts VM-crossing values into plain JSON-compatible data for stable assertions.
 */
function normalizeValue(value) {
    return JSON.parse(JSON.stringify(value));
}

test('dashboard event-management helpers keep pending as the only queue status and block owners from editing or deleting published events', () => {
    assert.equal(normalizeEventStatus(' Pending '), 'pending');
    assert.equal(isPendingLikeEventStatus('pending'), true);
    assert.equal(isPendingLikeEventStatus({ status: 'pending' }), true);
    assert.equal(isPendingLikeEventStatus('review'), false);
    assert.equal(canEditOwnEvent({ status: 'pending' }), true);
    assert.equal(canEditOwnEvent({ status: 'review' }), false);
    assert.equal(canEditOwnEvent({ status: 'published' }), false);
    assert.equal(canDeleteOwnEvent({ status: 'published' }), false);
    assert.equal(canManageOwnEvent({ status: 'pending' }), true);
    assert.equal(canManageOwnEvent({ status: 'review' }), false);
    assert.equal(canManageOwnEvent({ status: 'published' }), false);
    assert.equal(canOpenEventForm({ status: 'published' }), false);
    assert.equal(canOpenEventForm({ status: 'published' }, { allowAdminEdit: true }), true);
});

test('dashboard event-management helpers round-trip local form datetimes through ISO payloads', () => {
    const localInputValue = '2026-04-08T15:45';
    const isoValue = serializeDateTimeLocalInputValue(localInputValue);

    assert.equal(isoValue, new Date(localInputValue).toISOString());
    assert.equal(formatDateTimeLocalInputValue(isoValue), localInputValue);
    assert.equal(serializeDateTimeLocalInputValue('not-a-date'), '');
});

test('dashboard create-event modal serializes the datetime-local field before submitting to the API', async () => {
    const source = await readFile(DASHBOARD_CREATE_EVENT_MODAL_PATH, 'utf8');

    assert.match(source, /serializeDateTimeLocalInputValue\(readText\(formData\.date, ''\)\)/);
});

test('dashboard moderation helpers expose an edit action before approval and rejection controls', async () => {
    const hooks = await loadDashboardHooks();
    const actions = normalizeValue(hooks.readModerationEventActionDefinitions());

    assert.deepEqual(actions.map(action => action.action), ['edit', 'approve', 'reject', 'delete']);
});

test('dashboard ships admin discovery surfaces for published and rejected events', async () => {
    const html = await readFile(DASHBOARD_TEMPLATE_PATH, 'utf8');
    const hooks = await loadDashboardHooks();
    const publishedEvents = normalizeValue(hooks.filterAdminPublishedDiscoveryEvents([
        { id: 'evt-admin-own', status: 'published', organizerId: 'admin-1' },
        { id: 'evt-other-published', status: 'published', organizerId: 'member-2' },
        { id: 'evt-other-pending', status: 'pending', organizerId: 'member-3' },
    ], 'admin-1'));
    const rejectedEvents = normalizeValue(hooks.filterAdminRejectedDiscoveryEvents([
        { id: 'evt-admin-own-rejected', status: 'rejected', organizerId: 'admin-1' },
        { id: 'evt-other-rejected', status: 'rejected', organizerId: 'member-2' },
        { id: 'evt-other-pending', status: 'pending', organizerId: 'member-3' },
    ], 'admin-1'));

    assert.match(html, /id="dashboard-events-filter-moderation-scope"/);
    assert.match(html, /option value="rejected">Rejeitados de outras contas<\/option>/);
    assert.match(html, /option value="published">Publicados de outras contas<\/option>/);
    assert.equal(hooks.readModerationEventSourcePath('rejected'), '/events/moderation?status=rejected');
    assert.equal(hooks.readModerationEventSourcePath('published'), '/events');
    assert.deepEqual(
        normalizeValue(hooks.readModerationEventActionDefinitions({ scope: 'rejected' })).map(action => action.action),
        ['edit', 'delete'],
    );
    assert.deepEqual(
        normalizeValue(hooks.readModerationEventActionDefinitions({ scope: 'published' })).map(action => action.action),
        ['edit', 'delete'],
    );
    assert.deepEqual(publishedEvents.map(event => event.id), ['evt-other-published']);
    assert.deepEqual(rejectedEvents.map(event => event.id), ['evt-other-rejected']);
});

test('dashboard hides the admin pending-request preference by default in the template', async () => {
    const html = await readFile(DASHBOARD_TEMPLATE_PATH, 'utf8');

    assert.match(
        html,
        /<label class="checkbox-field dashboard-settings-preferences-item" hidden>[\s\S]*id="dashboard-settings-email-admin-pending"/,
    );
});

test('dashboard moderation action handler dispatches admin edits through the shared form for discovery items', async () => {
    const hooks = await loadDashboardHooks();
    const calls = [];
    const managedEvent = {
        id: 'evt-rejected-1',
        status: 'rejected',
    };

    await hooks.handleModerationQueueActionRequest({
        requestedAction: 'edit',
        managedEvent,
        isAdmin: true,
        isPendingModeration: false,
        allowDiscoveryEdit: true,
        openEdit: async (event) => {
            calls.push({ type: 'edit', eventId: event.id });
        },
        approve: async () => {
            calls.push({ type: 'approve' });
        },
        openReject: async () => {
            calls.push({ type: 'reject' });
        },
        showToast: (text) => {
            calls.push({ type: 'toast', text });
        },
    });

    assert.deepEqual(calls, [{ type: 'edit', eventId: 'evt-rejected-1' }]);
});

test('dashboard moderation action handler dispatches admin deletes through the shared confirmation flow', async () => {
    const hooks = await loadDashboardHooks();
    const calls = [];
    const managedEvent = {
        id: 'evt-published-1',
        status: 'published',
    };

    await hooks.handleModerationQueueActionRequest({
        requestedAction: 'delete',
        managedEvent,
        isAdmin: true,
        isPendingModeration: false,
        allowDiscoveryEdit: true,
        openDelete: async (event) => {
            calls.push({ type: 'delete', eventId: event.id });
        },
        openEdit: async () => {
            calls.push({ type: 'edit' });
        },
        approve: async () => {
            calls.push({ type: 'approve' });
        },
        openReject: async () => {
            calls.push({ type: 'reject' });
        },
        showToast: (text) => {
            calls.push({ type: 'toast', text });
        },
    });

    assert.deepEqual(calls, [{ type: 'delete', eventId: 'evt-published-1' }]);
});

test('dashboard moderation sync keeps queue edits visible after they move into pending', async () => {
    const hooks = await loadDashboardHooks();
    const queueEvents = normalizeValue(hooks.syncModerationEventsAfterAdminEdit([
        { id: 'evt-pending-1', status: 'pending', date: '2026-04-10T14:00:00.000Z' },
        { id: 'evt-pending-2', status: 'pending', date: '2026-04-08T14:00:00.000Z' },
    ], {
        id: 'evt-pending-1',
        status: 'pending',
        date: '2026-04-11T14:00:00.000Z',
    }, {
        scope: 'queue',
        previousEventId: 'evt-pending-1',
    }));
    const rejectedEvents = normalizeValue(hooks.syncModerationEventsAfterAdminEdit([
        { id: 'evt-rejected-1', status: 'rejected', date: '2026-04-10T14:00:00.000Z' },
        { id: 'evt-rejected-2', status: 'rejected', date: '2026-04-08T14:00:00.000Z' },
    ], {
        id: 'evt-rejected-1',
        status: 'pending',
        date: '2026-04-11T14:00:00.000Z',
    }, {
        scope: 'rejected',
        previousEventId: 'evt-rejected-1',
    }));

    assert.deepEqual(
        queueEvents.map(event => ({ id: event.id, status: event.status })),
        [
            { id: 'evt-pending-1', status: 'pending' },
            { id: 'evt-pending-2', status: 'pending' },
        ],
    );
    assert.deepEqual(rejectedEvents.map(event => event.id), ['evt-rejected-2']);
});