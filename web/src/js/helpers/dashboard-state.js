/**
 * Renders a clear unavailable state for the dashboard events surface.
 */
export function renderEventsUnavailableState(elements, {
    summaryText = 'Seus eventos estão indisponíveis no momento.',
    detailText = 'Não foi possível carregar seus eventos agora.',
    accountEventsTotalText = 'Indisponível',
} = {}) {
    if (!elements) {
        return;
    }

    elements.eventsLoading.hidden = true;
    elements.eventsList.replaceChildren();
    elements.eventsList.hidden = true;
    elements.eventsEmpty.hidden = false;
    elements.eventsEmpty.textContent = detailText;
    elements.eventsSummary.textContent = summaryText;
    elements.accountEventsTotal.textContent = accountEventsTotalText;
}