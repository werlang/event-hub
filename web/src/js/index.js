import '../css/index.css';

const API_URL = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || document.querySelector('meta[name="api-url"]')?.content || '';

const state = {
    token: localStorage.getItem('ae_token'),
    user: null,
    events: [],
};

const els = {
    eventsGrid: document.querySelector('#events-grid'),
    emptyState: document.querySelector('#empty-state'),
    filters: {
        search: document.querySelector('#filter-search'),
        category: document.querySelector('#filter-category'),
        from: document.querySelector('#filter-from'),
        to: document.querySelector('#filter-to'),
        audience: document.querySelector('#filter-audience'),
        apply: document.querySelector('#apply-filters'),
    },
    tabs: document.querySelectorAll('.tab'),
    loginForm: document.querySelector('#login-form'),
    registerForm: document.querySelector('#register-form'),
    eventForm: document.querySelector('#event-form'),
    authRequired: document.querySelector('#auth-required'),
    eventSuccess: document.querySelector('#event-success'),
    authHint: document.querySelector('#auth-hint'),
};

function qs(params) {
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '');
    return new URLSearchParams(entries).toString();
}

function renderEvents() {
    els.eventsGrid.innerHTML = '';
    if (!state.events.length) {
        els.emptyState.style.display = 'block';
        return;
    }

    els.emptyState.style.display = 'none';
    state.events.forEach(event => {
        const card = document.createElement('article');
        card.className = 'card';
        const date = new Date(event.date);
        card.innerHTML = `
            <div class="card__title">${event.title}</div>
            <div class="card__meta">
                <span>${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span>• ${event.location || 'Local a confirmar'}</span>
            </div>
            <p>${event.description}</p>
            <div class="card__meta">
                <span class="tag">${event.category || 'Geral'}</span>
                ${(event.audience || []).map(a => `<span class="tag">${a}</span>`).join('')}
            </div>
        `;
        els.eventsGrid.appendChild(card);
    });
}

async function fetchEvents() {
    const query = qs({
        search: els.filters.search.value,
        category: els.filters.category.value,
        from: els.filters.from.value,
        to: els.filters.to.value,
        audience: els.filters.audience.value,
    });

    const response = await fetch(`${API_URL}/events${query ? `?${query}` : ''}`);
    if (!response.ok) {
        console.error('Erro ao carregar eventos');
        return;
    }
    const payload = await response.json();
    state.events = payload.events || [];
    renderEvents();
}

function toggleAuthForms(target) {
    els.tabs.forEach(tab => {
        tab.classList.toggle('tab--active', tab.dataset.tab === target);
    });
    els.loginForm.classList.toggle('form--visible', target === 'login');
    els.registerForm.classList.toggle('form--visible', target === 'register');
}

function lockEventForm(locked) {
    els.eventForm.classList.toggle('form--disabled', locked);
    els.authRequired.style.display = locked ? 'block' : 'none';
}

async function fetchProfile() {
    if (!state.token) {
        lockEventForm(true);
        return;
    }
    const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) {
        localStorage.removeItem('ae_token');
        state.token = null;
        state.user = null;
        lockEventForm(true);
        return;
    }
    const payload = await response.json();
    state.user = payload.user;
    lockEventForm(false);
    els.authHint.textContent = `Autenticado como ${state.user.name}.`;
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.id === 'login-form' ? 'login' : 'register';
    const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    const payload = await response.json();
    if (!response.ok) {
        alert(payload.error || 'Falha na autenticação');
        return;
    }

    state.token = payload.token;
    localStorage.setItem('ae_token', state.token);
    state.user = payload.user;
    lockEventForm(false);
    els.authHint.textContent = `Autenticado como ${state.user.name}.`;
}

async function handleEventSubmit(event) {
    event.preventDefault();
    if (!state.token) {
        alert('Faça login para publicar.');
        return;
    }

    const data = Object.fromEntries(new FormData(event.target).entries());
    const payload = {
        ...data,
        audience: data.audience ? data.audience.split(',').map(a => a.trim()).filter(Boolean) : [],
    };

    const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify(payload),
    });

    const body = await response.json();
    if (!response.ok) {
        alert(body.error || 'Não foi possível publicar o evento.');
        return;
    }

    event.target.reset();
    els.eventSuccess.hidden = false;
    setTimeout(() => els.eventSuccess.hidden = true, 3000);
    await fetchEvents();
}

function bindEvents() {
    els.tabs.forEach(tab => tab.addEventListener('click', () => toggleAuthForms(tab.dataset.tab)));
    els.filters.apply.addEventListener('click', fetchEvents);
    els.loginForm.addEventListener('submit', handleAuthSubmit);
    els.registerForm.addEventListener('submit', handleAuthSubmit);
    els.eventForm.addEventListener('submit', handleEventSubmit);
}

async function init() {
    bindEvents();
    await fetchProfile();
    await fetchEvents();
}

init();
