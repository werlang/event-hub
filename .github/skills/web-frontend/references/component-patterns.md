# Frontend Patterns

Patterns aligned with the current home/login bundles and the shared helper/component layer.

## Home Boot Pattern

```javascript
export function initHomePage() {
    const elements = createElements();
    const eventList = new EventList({
        grid: elements.grid,
        emptyState: elements.emptyState,
    });
    const filterForm = new FilterForm({
        form: elements.filterForm,
        filterSearch: elements.filterSearch,
        filterCategory: elements.filterCategory,
        filterFrom: elements.filterFrom,
        filterTo: elements.filterTo,
    });
    const quickChips = new QuickChips({ container: elements.quickChips });
}
```

## Query String Helper

```javascript
const params = createHomeFilterParams({
    search: filters.search,
    category: filters.category,
    from: filters.from,
    to: filters.to,
});

syncUrlWithParams(params);
```

## Envelope-Aware Request Pattern

```javascript
const response = await requestApi('/events');

if (!response.ok) {
    showMessage(response.message || 'Falha ao processar a requisição.');
    return;
}

const events = response.data?.events || [];
eventList.render(events);
```

## Filter Form Binding

```javascript
filterForm.bindApply((filters) => {
    loadEvents(filters);
});

quickChips.bindSelect((chipFilters) => {
    const mergedFilters = {
        ...filterForm.readFilters(),
        ...chipFilters,
    };

    filterForm.hydrate(mergedFilters);
    loadEvents(mergedFilters);
});
```

## Login Tabs Pattern

```javascript
const authTabs = new AuthTabs({
    tabs,
    loginForm,
    registerForm,
    onChange: syncAuthHash,
});

authTabs.setRegisterEnabled(true);
authTabs.wire();
authTabs.setActive(readInitialAuthTab());
```

## Notes

- The current repository does not have an active `publish.js` entry.
- Use the root `.github/references/` folder as style inspiration for class-based DOM APIs, but keep implementation details anchored in the live `web/src/js/` files.