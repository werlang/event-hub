import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';

import { Pagination } from '../src/js/components/pagination.js';

/**
 * Installs one JSDOM window as the active global DOM for a pagination contract test.
 */
function installDomGlobals(dom) {
    const keys = [
        'window',
        'document',
        'Node',
        'Element',
        'HTMLElement',
        'HTMLButtonElement',
        'DocumentFragment',
        'Event',
        'MouseEvent',
    ];
    const previousDescriptors = new Map();

    for (const key of keys) {
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
            if (previousDescriptor) {
                Object.defineProperty(globalThis, key, previousDescriptor);
                continue;
            }

            delete globalThis[key];
        }
    };
}

/**
 * Creates one JSDOM document for a pagination contract test.
 */
function createDom() {
    return new JSDOM('<main><div id="pagination"></div></main>', {
        url: 'http://localhost/',
        pretendToBeVisual: true,
    });
}

test('Pagination renders compact public navigation controls and dispatches page changes', () => {
    const dom = createDom();
    const restore = installDomGlobals(dom);

    try {
        const container = document.querySelector('#pagination');
        const pageChanges = [];
        const pagination = new Pagination({
            container,
            ariaLabel: 'Paginação dos eventos públicos',
            pageSize: 10,
        });
        const items = Array.from({ length: 95 }, (_, index) => ({ id: index + 1 }));

        pagination.onPageChange(({ page }) => {
            pageChanges.push(page);
        });
        pagination.render({ items, currentPage: 5 });

        assert.equal(container.hidden, false);
        assert.equal(
            container.querySelector('.pagination__summary')?.textContent,
            'Mostrando 41 a 50 de 95 eventos.',
        );
        assert.equal(
            container.querySelector('.pagination__controls')?.getAttribute('aria-label'),
            'Paginação dos eventos públicos',
        );
        assert.equal(container.querySelectorAll('.pagination__gap').length, 2);
        assert.equal(
            container.querySelector('button[aria-current="page"] span')?.textContent,
            '5',
        );

        container.querySelector('button[data-page="6"]')?.dispatchEvent(new dom.window.MouseEvent('click', {
            bubbles: true,
        }));

        assert.deepEqual(pageChanges, [6]);
    } finally {
        restore();
        dom.window.close();
    }
});

test('Pagination clamps public slices and hides itself for empty or single-page result sets', () => {
    const dom = createDom();
    const restore = installDomGlobals(dom);

    try {
        const container = document.querySelector('#pagination');
        const pagination = new Pagination({
            container,
            ariaLabel: 'Paginação da agenda',
            pageSize: 10,
        });

        pagination.render({ items: [], currentPage: 99 });
        assert.equal(container.hidden, true);
        assert.equal(
            container.querySelector('.pagination__summary')?.textContent,
            'Mostrando 0 de 0 eventos.',
        );
        assert.equal(container.querySelectorAll('button').length, 0);

        const onePageItems = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));
        pagination.render({ items: onePageItems, currentPage: 4 });
        assert.equal(container.hidden, true);
        assert.equal(
            container.querySelector('.pagination__summary')?.textContent,
            'Mostrando 8 de 8 eventos.',
        );

        assert.equal(pagination.clampPage('foo', 3), 1);
        assert.equal(pagination.clampPage(99, onePageItems), 1);
        assert.deepEqual(
            pagination.readPageItems(Array.from({ length: 25 }, (_, index) => index + 1), 99),
            [21, 22, 23, 24, 25],
        );
    } finally {
        restore();
        dom.window.close();
    }
});