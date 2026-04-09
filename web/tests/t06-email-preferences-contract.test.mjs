import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const DASHBOARD_TEMPLATE_PATH = path.join(WEB_ROOT, 'src/html/dashboard.html');
const DASHBOARD_SETTINGS_PANELS_PATH = path.join(WEB_ROOT, 'src/js/dashboard/settings-panels.js');

test('dashboard settings remove the weekly digest toggle while keeping the remaining email preferences', async () => {
    const [dashboardHtml, settingsPanelsSource] = await Promise.all([
        readFile(DASHBOARD_TEMPLATE_PATH, 'utf8'),
        readFile(DASHBOARD_SETTINGS_PANELS_PATH, 'utf8'),
    ]);

    assert.doesNotMatch(dashboardHtml, /dashboard-settings-email-weekly/);
    assert.doesNotMatch(dashboardHtml, /name="weeklyDigest"/i);
    assert.match(dashboardHtml, /dashboard-settings-email-event-updates/);
    assert.match(dashboardHtml, /dashboard-settings-email-admin-pending/);

    assert.doesNotMatch(settingsPanelsSource, /weeklyDigest/);
    assert.match(settingsPanelsSource, /dashboard-settings-email-event-updates/);
    assert.match(settingsPanelsSource, /dashboard-settings-email-admin-pending/);
});