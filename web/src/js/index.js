import '../css/index.css';

const API_URL = (window.APP_CONFIG && window.APP_CONFIG.apiUrl) || document.querySelector('meta[name="api-url"]')?.content || '';

const state = {
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
};

function paramsFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        search: urlParams.get('search') || urlParams.get('q') || '',
        category: urlParams.get('category') || '',
        from: urlParams.get('from') || '',
        to: urlParams.get('to') || '',
        audience: urlParams.get('audience') || '',
    };
}

function applyParamsToInputs(params) {
    els.filters.search.value = params.search || '';
    els.filters.category.value = params.category || '';
    els.filters.from.value = params.from || '';
    els.filters.to.value = params.to || '';
    els.filters.audience.value = params.audience || '';
}

function buildQueryFromInputs() {
    const params = new URLSearchParams();
    if (els.filters.search.value) params.set('search', els.filters.search.value);
    if (els.filters.category.value) params.set('category', els.filters.category.value);
    if (els.filters.from.value) params.set('from', els.filters.from.value);
    if (els.filters.to.value) params.set('to', els.filters.to.value);
    if (els.filters.audience.value) params.set('audience', els.filters.audience.value);
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    return qs;
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

async function fetchEventsWithParams() {
    const qs = buildQueryFromInputs();
    const response = await fetch(`${API_URL}/events${qs ? `?${qs}` : ''}`);
    if (!response.ok) {
        els.emptyState.textContent = 'Erro ao carregar eventos. Tente novamente.';
        els.emptyState.style.display = 'block';
        return;
    }
    const payload = await response.json();
    state.events = payload.events || [];
    renderEvents();
}

function bindFilters() {
    els.filters.apply.addEventListener('click', fetchEventsWithParams);
    ['search', 'category', 'from', 'to', 'audience'].forEach(key => {
        const el = els.filters[key];
        el?.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                fetchEventsWithParams();
            }
        });
    });
}

async function init() {
    if (els.emptyState) {
        els.emptyState.style.display = 'none';
    }
    const initialParams = paramsFromUrl();
    applyParamsToInputs(initialParams);
    bindFilters();
    await fetchEventsWithParams();
}

init();
