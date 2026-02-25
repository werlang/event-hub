import '../css/index.css';

const API_URL = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || document.querySelector('meta[name="api-url"]')?.content || '';

const state = {
    redirect: new URLSearchParams(window.location.search).get('redirect') || '/',
};

const els = {
    tabs: document.querySelectorAll('.tab'),
    loginForm: document.querySelector('#login-form'),
    registerForm: document.querySelector('#register-form'),
    message: document.querySelector('#auth-message'),
};

function toggleAuthForms(target) {
    els.tabs.forEach(tab => tab.classList.toggle('tab--active', tab.dataset.tab === target));
    els.loginForm.classList.toggle('form--visible', target === 'login');
    els.registerForm.classList.toggle('form--visible', target === 'register');
}

function showMessage(text, tone = 'alert') {
    if (!els.message) return;
    els.message.hidden = !text;
    els.message.textContent = text || '';
    els.message.className = tone === 'success' ? 'toast' : 'alert';
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.id === 'login-form' ? 'login' : 'register';
    showMessage('');

    const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const payload = await response.json();

    if (!response.ok) {
        showMessage(payload.error || 'Falha na autenticação.');
        return;
    }

    localStorage.setItem('ae_token', payload.token);
    showMessage('Autenticação concluída. Redirecionando...', 'success');
    window.location.href = state.redirect || '/';
}

function bindEvents() {
    els.tabs.forEach(tab => tab.addEventListener('click', () => toggleAuthForms(tab.dataset.tab)));
    els.loginForm?.addEventListener('submit', handleAuthSubmit);
    els.registerForm?.addEventListener('submit', handleAuthSubmit);
}

function init() {
    const initialTab = new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login';
    toggleAuthForms(initialTab);
    bindEvents();
}

init();
