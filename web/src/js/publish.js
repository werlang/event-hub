import '../css/index.css';

const API_URL = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || document.querySelector('meta[name="api-url"]')?.content || '';

const state = {
    token: localStorage.getItem('ae_token'),
    user: null,
};

const els = {
    form: document.querySelector('#event-form'),
    success: document.querySelector('#event-success'),
    authState: document.querySelector('#auth-state'),
};

function redirectToLogin() {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?redirect=${redirect}`;
}

function setAuthMessage(text, tone = 'alert') {
    if (!els.authState) return;
    els.authState.hidden = !text;
    els.authState.textContent = text || '';
    els.authState.className = tone === 'success' ? 'toast' : 'alert';
}

function lockForm(locked) {
    els.form?.classList.toggle('form--disabled', locked);
}

async function fetchProfile() {
    if (!state.token) {
        setAuthMessage('Faça login para publicar um evento.');
        lockForm(true);
        return redirectToLogin();
    }

    const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!response.ok) {
        localStorage.removeItem('ae_token');
        setAuthMessage('Sessão expirada. Faça login novamente.');
        lockForm(true);
        return redirectToLogin();
    }

    const payload = await response.json();
    state.user = payload.user;
    setAuthMessage(`Autenticado como ${state.user.name}.`, 'success');
    lockForm(false);
}

async function handleSubmit(event) {
    event.preventDefault();
    if (!state.token) {
        return redirectToLogin();
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
    if (response.status === 401) {
        localStorage.removeItem('ae_token');
        return redirectToLogin();
    }
    if (!response.ok) {
        setAuthMessage(body.error || 'Não foi possível salvar o evento.');
        return;
    }

    event.target.reset();
    if (els.success) {
        els.success.hidden = false;
        setTimeout(() => els.success.hidden = true, 3500);
    }
    setAuthMessage('Evento publicado com sucesso.', 'success');
}

function bind() {
    els.form?.addEventListener('submit', handleSubmit);
}

async function init() {
    lockForm(true);
    bind();
    await fetchProfile();
}

init();
