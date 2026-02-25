# Frontend Patterns

Patterns aligned with `web/src/js/index.js` in this repository.

## State + DOM Cache

```javascript
const state = {
    token: localStorage.getItem('ae_token'),
    user: null,
    events: [],
};

const els = {
    eventsGrid: document.querySelector('#events-grid'),
    emptyState: document.querySelector('#empty-state'),
};
```

## Query String Helper

```javascript
function qs(params) {
    const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '');
    return new URLSearchParams(entries).toString();
}
```

## Fetch + Render Flow

```javascript
async function fetchEvents() {
    const query = qs({ search: filterSearch.value, category: filterCategory.value });
    const response = await fetch(`${API_URL}/events${query ? `?${query}` : ''}`);
    if (!response.ok) return;

    const payload = await response.json();
    state.events = payload.events || [];
    renderEvents();
}
```

## Form Submit Handler Pattern

```javascript
async function handleAuthSubmit(event) {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.target).entries());
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
    });

    const payload = await response.json();
    if (!response.ok) {
        alert(payload.error || 'Falha na autenticação');
        return;
    }
}
```

## Init Pattern

```javascript
function bindEvents() {
    loginForm.addEventListener('submit', handleAuthSubmit);
    registerForm.addEventListener('submit', handleAuthSubmit);
    eventForm.addEventListener('submit', handleEventSubmit);
}

async function init() {
    bindEvents();
    await fetchProfile();
    await fetchEvents();
}

init();
```