import assert from 'node:assert/strict';
import test from 'node:test';

import { renderMiddleware, safeJsonStringify } from '../middleware/render.js';

test('safeJsonStringify escapes script-breaking JSON content', () => {
    const serialized = safeJsonStringify({
        title: '</script><img src=x onerror=alert(1)>',
        ampersand: 'a & b',
    });

    assert.doesNotMatch(serialized, /<\/script>/i);
    assert.match(serialized, /\\u003c\/script\\u003e/);
    assert.match(serialized, /\\u0026/);
    assert.equal(JSON.parse(serialized).title, '</script><img src=x onerror=alert(1)>');
});

test('renderMiddleware preserves falsy template vars and removes only undefined values', async () => {
    let rendered = null;
    let nextCalled = false;

    const middleware = renderMiddleware({
        fixedFalse: false,
        fixedZero: 0,
        fixedUndefined: undefined,
    });
    const response = {
        render(view, vars) {
            rendered = { view, vars };
        },
    };

    middleware({}, response, () => {
        nextCalled = true;
    });

    await response.templateRender('index', {
        localFalse: false,
        localZero: 0,
        localEmpty: '',
        localUndefined: undefined,
        dangerous: '</script>',
    });

    assert.equal(nextCalled, true);
    assert.equal(rendered.view, 'index');
    assert.equal(rendered.vars.fixedFalse, false);
    assert.equal(rendered.vars.fixedZero, 0);
    assert.equal(rendered.vars.localFalse, false);
    assert.equal(rendered.vars.localZero, 0);
    assert.equal(rendered.vars.localEmpty, '');
    assert.equal('fixedUndefined' in rendered.vars, false);
    assert.equal('localUndefined' in rendered.vars, false);

    const clientJson = rendered.vars['template-vars'].match(/<script id="template-vars" type="application\/json">([\s\S]*)<\/script>/i)?.[1];
    assert.ok(clientJson);
    assert.doesNotMatch(clientJson, /<\/script>/i);
    assert.equal(JSON.parse(clientJson).dangerous, '</script>');
});

