import { Event } from '../helpers/event.js';

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

/**
 * Formats an event count with singular/plural agreement.
 */
function formatCount(total, singular, plural) {
    return `${total} ${total === 1 ? singular : plural}`;
}

/**
 * Formats a rounded percentage used in dashboard summary support copy.
 */
function formatPercentage(value, total) {
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
        return '0%';
    }

    return `${Math.round((value / total) * 100)}%`;
}

/**
 * Returns the summary tone associated with an event moderation status.
 */
function readSummaryStatusTone(status) {
    const normalizedStatus = String(status || 'pending').trim().toLowerCase();

    if (normalizedStatus === 'published') {
        return 'success';
    }

    if (normalizedStatus === 'rejected') {
        return 'warning';
    }

    return 'pending';
}

/**
 * Counts events matching a predicate without assuming a valid array input.
 */
export function countEvents(events, predicate) {
    if (!Array.isArray(events) || typeof predicate !== 'function') {
        return 0;
    }

    return events.filter(predicate).length;
}

/**
 * Reports whether an event is current or upcoming for dashboard summary purposes.
 */
function isUpcomingEvent(event) {
    const eventRecord = Event.from(event);
    return Boolean(eventRecord.toJSON().date) && !eventRecord.isPast();
}

/**
 * Builds the dashboard summary-card model from the current event list.
 */
export function createSummaryCards(events) {
    const total = Array.isArray(events) ? events.length : 0;
    const pending = countEvents(events, event => readSummaryStatusTone(event?.status) === 'pending');
    const published = countEvents(events, event => readSummaryStatusTone(event?.status) === 'success');
    const rejected = countEvents(events, event => readSummaryStatusTone(event?.status) === 'warning');
    const upcoming = countEvents(events, isUpcomingEvent);

    return [
        {
            id: 'submitted',
            eyebrow: 'Panorama',
            label: 'Visão geral',
            value: total,
            unit: total === 1 ? 'envio registrado' : 'envios registrados',
            note: total === 0
                ? 'Crie o primeiro evento pelo botão Novo Evento no topo para começar a acompanhar aprovação, publicação e agenda por aqui.'
                : 'Este cartão concentra a leitura mais rápida do que já entrou no fluxo da sua conta.',
            meta: total === 0
                ? 'Ainda sem atividade'
                : `${formatCount(upcoming, 'próximo', 'próximos')} na agenda`,
            highlights: total === 0
                ? ['Use o botão Novo Evento', 'Os indicadores aparecem aqui']
                : [
                    formatCount(published, 'publicado', 'publicados'),
                    pending > 0 ? formatCount(pending, 'pendente', 'pendentes') : 'Sem pendências',
                    formatCount(upcoming, 'próximo', 'próximos'),
                ],
            icon: 'chart-column',
            tone: 'main',
            featured: true,
        },
        {
            id: 'pending',
            eyebrow: 'Moderação',
            label: 'Pendentes',
            value: pending,
            unit: 'aguardando análise',
            note: pending === 0
                ? 'Nenhum envio aguardando aprovação no momento.'
                : `${formatCount(pending, 'envio está', 'envios estão')} na fila da moderação.`,
            meta: total === 0 ? 'Sem base ainda' : `${formatPercentage(pending, total)} do total`,
            icon: 'clock',
            tone: 'pending',
        },
        {
            id: 'published',
            eyebrow: 'Publicação',
            label: 'Publicados',
            value: published,
            unit: 'já estão visíveis',
            note: published === 0
                ? 'Nenhum evento publicado ainda na agenda pública.'
                : `${formatCount(published, 'evento já aparece', 'eventos já aparecem')} na agenda pública.`,
            meta: total === 0 ? 'Sem base ainda' : `${formatPercentage(published, total)} do total`,
            icon: 'check',
            tone: 'success',
        },
        {
            id: 'rejected',
            eyebrow: 'Ajustes',
            label: 'Rejeitados',
            value: rejected,
            unit: 'pedem ajuste',
            note: rejected === 0
                ? 'Nenhum envio devolvido para ajustes agora.'
                : `${formatCount(rejected, 'envio precisa', 'envios precisam')} de ajustes antes de voltar para aprovação.`,
            meta: total === 0 ? 'Sem base ainda' : `${formatPercentage(rejected, total)} do total`,
            icon: 'triangle-exclamation',
            tone: 'warning',
        },
        {
            id: 'upcoming',
            eyebrow: 'Agenda',
            label: 'Próximos',
            value: upcoming,
            unit: 'ainda vão acontecer',
            note: upcoming === 0
                ? 'Não há eventos futuros registrados neste momento.'
                : `${formatCount(upcoming, 'evento ainda vai acontecer', 'eventos ainda vão acontecer')} na sua agenda.`,
            meta: total === 0 ? 'Sem base ainda' : `${formatPercentage(upcoming, total)} do total`,
            icon: 'calendar-days',
            tone: 'neutral',
        },
    ];
}

/**
 * Creates one summary-card DOM node for the overview section.
 */
export function createSummaryCardElement(card) {
    const element = document.createElement('article');
    element.className = card.featured
        ? `dashboard-summary-card dashboard-summary-card--${card.tone} dashboard-summary-card--featured`
        : `dashboard-summary-card dashboard-summary-card--${card.tone}`;

    const top = document.createElement('div');
    top.className = 'dashboard-summary-card__top';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'dashboard-summary-card__eyebrow';
    eyebrow.textContent = readText(card.eyebrow, 'Resumo');

    const icon = document.createElement('span');
    icon.className = 'dashboard-summary-card__icon';

    const iconElement = document.createElement('i');
    iconElement.classList.add('fa-solid', `fa-${readText(card.icon, 'chart-column')}`);
    iconElement.setAttribute('aria-hidden', 'true');
    icon.appendChild(iconElement);

    top.append(eyebrow, icon);

    const label = document.createElement('h3');
    label.className = 'dashboard-summary-card__label';
    label.textContent = card.label;

    const metric = document.createElement('div');
    metric.className = 'dashboard-summary-card__metric';

    const value = document.createElement('strong');
    value.className = 'dashboard-summary-card__value';
    value.textContent = String(card.value);

    const unit = document.createElement('span');
    unit.className = 'dashboard-summary-card__unit';
    unit.textContent = readText(card.unit, 'itens');

    metric.append(value, unit);

    const highlights = document.createElement('div');
    highlights.className = 'dashboard-summary-card__highlights';

    (Array.isArray(card.highlights) ? card.highlights : []).forEach((highlight) => {
        const highlightElement = document.createElement('span');
        highlightElement.className = 'dashboard-summary-card__highlight';
        highlightElement.textContent = readText(highlight, '');
        highlights.appendChild(highlightElement);
    });

    const note = document.createElement('p');
    note.className = 'dashboard-summary-card__note';
    note.textContent = card.note;

    const meta = document.createElement('p');
    meta.className = 'dashboard-summary-card__meta';
    meta.textContent = readText(card.meta, '');

    element.append(top, label, metric);

    if (highlights.childElementCount > 0) {
        element.appendChild(highlights);
    }

    element.append(note, meta);
    return element;
}

