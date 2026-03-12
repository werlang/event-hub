import '../css/login.css';

import { AuthTabs } from './components/auth-tabs.js';

function readInitialAuthTab() {
	return window.location.hash === '#register' ? 'register' : 'login';
}

function syncAuthHash(activeTab) {
	const nextHash = activeTab === 'register' ? '#register' : '';
	const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
	const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

	if (currentUrl === nextUrl) {
		return;
	}

	window.history.replaceState(null, '', nextUrl);
}

function initAuthTabs() {
	const tabs = Array.from(document.querySelectorAll('.tabs .tab[data-tab]'));
	const loginForm = document.querySelector('#login-form');
	const registerForm = document.querySelector('#register-form');

	if (!tabs.length || !loginForm || !registerForm) {
		return;
	}

	const authTabs = new AuthTabs({
		tabs,
		loginForm,
		registerForm,
		onChange: syncAuthHash,
	});

	authTabs.setRegisterEnabled(true);
	authTabs.wire();
	authTabs.setActive(readInitialAuthTab());
}

initAuthTabs();
