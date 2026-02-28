# Frontend Patterns

Patterns aligned with `web/src/js/{index,login,publish}.js` and `web/src/js/helpers/api.js`.

## Page Dispatch

```javascript
const page = TemplateVar.get('page');

if (page === 'login') {
    initLoginPage();
} else if (page === 'publish') {
    initPublishPage();
} else {
    initHomePage();
}
```

## Query String Helper

```javascript
function serializeFilters() {
    const params = new URLSearchParams();
    const map = {
        search: homeElements.filterSearch?.value,
        category: homeElements.filterCategory?.value,
        from: homeElements.filterFrom?.value,
        to: homeElements.filterTo?.value,
        audience: homeElements.filterAudience?.value,
    };

    Object.entries(map).forEach(([key, value]) => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (trimmed) params.set(key, trimmed);
    });

    return params;
}
```

## Envelope-Aware Request Pattern

```javascript
const response = await requestApi('/events');

if (!response.ok) {
    showMessage(response.message || 'Falha ao processar a requisição.');
    return;
}

const events = response.data?.events || [];
renderEvents(events);
```

## Form Submit Handler Pattern

```javascript
async function handlePublishSubmit(event) {
    event.preventDefault();
    const payload = toEventPayload(elements.eventForm);

    const response = await requestApi('/events', {
        method: 'POST',
        token,
        body: payload,
    });

    if (!response.ok) {
        showAuthState(response.message || 'Não foi possível publicar o evento.');
        return;
    }
}
```

## Init Pattern

```javascript
function bindEvents() {
    homeElements.applyFilters.addEventListener('click', () => {
        loadEvents();
    });
}

function initHomePage() {
    bindEvents();
    hydrateFiltersFromUrl();
    loadEvents();
}
```