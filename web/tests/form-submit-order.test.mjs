import assert from 'node:assert/strict';
import test from 'node:test';

import { Form } from '../src/js/components/form.js';

function createFakeFormElement() {
	const listeners = new Map();
	const element = Object.create(globalThis.HTMLFormElement?.prototype || Object.prototype);
	Object.assign(element, {
		classList: {
			toggle() {},
			add() {},
			remove() {},
		},
		hidden: false,
		addEventListener(eventName, listener) {
			listeners.set(eventName, listener);
		},
		removeEventListener(eventName, listener) {
			if (listeners.get(eventName) === listener) {
				listeners.delete(eventName);
			}
		},
		querySelectorAll() {
			return [];
		},
		querySelector() {
			return null;
		},
		reset() {},
		setAttribute() {},
		getAttribute() {
			return null;
		},
		closest() {
			return null;
		},
		listeners,
	});

	return element;
}

test('Form.submit reads values before disabling the form', async () => {
	const originalHTMLFormElement = globalThis.HTMLFormElement;
	const originalFormData = globalThis.FormData;
	globalThis.HTMLFormElement = class HTMLFormElement {};
	const element = createFakeFormElement();
	const form = new Form(element);
	let capturedValues = null;
	let readWhileDisabled = null;

	globalThis.FormData = class {
		constructor(target) {
			readWhileDisabled = target.disabled === true;
		}

		*entries() {
			yield ['email', 'test@example.com'];
			yield ['password', 'secret'];
		}
	};

	try {
		form.submit(async (values) => {
			capturedValues = values;
		});

		const submitHandler = element.listeners.get('submit');
		assert.equal(typeof submitHandler, 'function');

		await submitHandler({ preventDefault() {} });

		assert.equal(readWhileDisabled, false);
		assert.deepEqual(capturedValues, {
			email: 'test@example.com',
			password: 'secret',
		});
	} finally {
		globalThis.HTMLFormElement = originalHTMLFormElement;
		globalThis.FormData = originalFormData;
	}
});