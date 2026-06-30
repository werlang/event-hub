import '../css/dashboard.css';

import { BaseComponent } from './components/base-component.js';
import { Button } from './components/button.js';
import { Header } from './components/header.js';
import { createLinkedTextContent } from './components/linked-text.js';
import { DashboardActionTabs } from './dashboard/action-tabs.js';
import { DashboardEventFormModal } from './dashboard/create-event-modal.js';
import { DashboardDeleteEventModal } from './dashboard/delete-event-modal.js';
import { canDeleteOwnEvent, canEditOwnEvent, isPendingLikeEventStatus } from './dashboard/event-management.js';
import {
    DashboardFilters,
    createDefaultDashboardBrowseFilters,
    filterDashboardBrowseEvents,
    formatDashboardBrowseBadge,
    readDashboardBrowseCaption,
    readDashboardBrowseEmptyState,
} from './dashboard/filters.js';
import { DashboardRejectEventModal } from './dashboard/reject-event-modal.js';
import { DashboardSettingsPanels } from './dashboard/settings-panels.js';
import { Pagination } from './components/pagination.js';
import { Toast } from './components/toast.js';
import { Tooltip } from './components/tooltip.js';
import { requestApi } from './helpers/api.js';
import { Event } from './helpers/event.js';

const DASHBOARD_STATUS_TOAST_GROUP = 'dashboard-status';
const DASHBOARD_ACTION_TOAST_GROUP = 'dashboard-action';
const DASHBOARD_HIDDEN_CLASS = 'dashboard-empty-state--hidden';
const DASHBOARD_EVENTS_PER_PAGE = 10;
const DASHBOARD_VIEW_BROWSE = 'browse';
const DASHBOARD_VIEW_MODERATION = 'moderation';
const DASHBOARD_VIEW_SETTINGS = 'settings';
const DASHBOARD_MODERATION_SCOPE_QUEUE = 'queue';
const DASHBOARD_MODERATION_SCOPE_REJECTED = 'rejected';
const DASHBOARD_MODERATION_SCOPE_PUBLISHED = 'published';

/**
 * Returns the UI metadata associated with an event moderation status.
 */
function readStatusMeta(status) {
    const normalizedStatus = String(status || 'pending').trim().toLowerCase();

    if (normalizedStatus === 'published') {
        return {
            label: 'Publicado',
            tone: 'success',
            note: 'Este evento já está visível na agenda pública.',
            icon: 'check',
        };
    }

    if (normalizedStatus === 'rejected') {
        return {
            label: 'Rejeitado',
            tone: 'warning',
            note: 'Este envio precisa de ajustes antes de voltar para aprovação.',
            icon: 'exclamation',
        };
    }

    return {
        label: 'Pendente',
        tone: 'pending',
        note: 'Este envio ainda está aguardando aprovação.',
        icon: 'clock',
    };
}

/**
 * Returns a localized label for the authenticated account role.
 */
function readRoleLabel(role) {
    return isAdminRole(role)
        ? 'Administrador'
        : 'Membro';
}

/**
 * Reports whether one account role belongs to an administrator.
 */
function isAdminRole(role) {
    return String(role || '').trim().toLowerCase() === 'admin';
}

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
 * Returns the introductory dashboard copy associated with one account role.
 */
function readDashboardShellInstruction(role) {
    return isAdminRole(role)
        ? 'Use os botões abaixo para alternar entre seus envios, moderar a fila pendente, criar novos eventos ou revisar as configurações da conta.'
        : 'Use os botões abaixo para navegar entre seus envios, criar novos eventos ou revisar as configurações da sua conta.';
}

/**
 * Returns the copy used by the list section for the active dashboard view.
 */
function readEventSectionCopy(view, { moderationScope = DASHBOARD_MODERATION_SCOPE_QUEUE } = {}) {
    if (view === DASHBOARD_VIEW_MODERATION && isPublishedModerationScope(moderationScope)) {
        return {
            eyebrow: 'Moderação',
            heading: 'Eventos Publicados',
            description: 'Encontre eventos já publicados e abra a edição administrativa quando um ajuste precisar voltar para moderação.',
            badgeSingular: 'publicado',
            badgePlural: 'publicados',
            populatedCaption: 'Abaixo ficam os eventos publicados, ordenados da data mais recente para a mais antiga.',
            emptyCaption: 'Quando houverem eventos publicados, eles aparecerão aqui para edição administrativa.',
            emptyState: 'Nenhum evento publicado está disponível para edição agora.',
        };
    }

    if (view === DASHBOARD_VIEW_MODERATION && isRejectedModerationScope(moderationScope)) {
        return {
            eyebrow: 'Moderação',
            heading: 'Eventos Rejeitados',
            description: 'Encontre eventos rejeitados para ajustes administrativos e devolva-os ao fluxo de moderação.',
            badgeSingular: 'rejeitado',
            badgePlural: 'rejeitados',
            populatedCaption: 'Abaixo ficam os eventos rejeitados, ordenados da data mais recente para a mais antiga, para reabertura administrativa do fluxo de moderação.',
            emptyCaption: 'Quando houverem eventos rejeitados, eles aparecerão aqui para edição administrativa.',
            emptyState: 'Nenhum evento rejeitado está disponível para edição agora.',
        };
    }

    if (view === DASHBOARD_VIEW_MODERATION) {
        return {
            eyebrow: 'Moderação',
            heading: 'Fila de moderação',
            description: 'Analise os eventos pendentes enviados e decida se cada um deve ser publicado ou devolvido para ajustes.',
            badgeSingular: 'pendente',
            badgePlural: 'pendentes',
            populatedCaption: 'Abaixo ficam os envios que ainda aguardam avaliação administrativa, ordenados da data mais recente para a mais antiga.',
            emptyCaption: 'Quando novos eventos aguardarem análise administrativa, eles aparecerão aqui para aprovação ou rejeição.',
            emptyState: 'Nenhum evento aguardando moderação na fila agora.',
        };
    }

    return {
        eyebrow: 'Eventos',
        heading: 'Todos os seus eventos',
        description: 'Consulte a lista completa dos eventos criados pela sua conta, com status, data, categoria e local.',
        badgeSingular: 'evento',
        badgePlural: 'eventos',
        populatedCaption: 'Abaixo ficam todos os seus eventos, ordenados da data mais recente para a mais antiga.',
        emptyCaption: 'Quando novos envios forem criados, eles aparecerão aqui com o respectivo status de moderação.',
        emptyState: 'Você ainda não enviou nenhum evento. Use o botão Novo Evento no topo para criar o primeiro.',
    };
}

/**
 * Counts events matching a predicate without assuming a valid array input.
 */
function countEvents(events, predicate) {
    if (!Array.isArray(events) || typeof predicate !== 'function') {
        return 0;
    }

    return events.filter(predicate).length;
}

/**
 * Reports whether an event is still pending moderation.
 */
function isPendingModerationEvent(event) {
    return isPendingLikeEventStatus(event);
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
function createSummaryCards(events) {
    const total = Array.isArray(events) ? events.length : 0;
    const pending = countEvents(events, event => readStatusMeta(event?.status).tone === 'pending');
    const published = countEvents(events, event => readStatusMeta(event?.status).tone === 'success');
    const rejected = countEvents(events, event => readStatusMeta(event?.status).tone === 'warning');
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
function createSummaryCardElement(card) {
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

/**
 * Normalizes the admin moderation surface between queue and discovery modes.
 */
function normalizeModerationScope(value) {
    const normalizedValue = String(value || DASHBOARD_MODERATION_SCOPE_QUEUE).trim().toLowerCase();

    if (normalizedValue === DASHBOARD_MODERATION_SCOPE_PUBLISHED) {
        return DASHBOARD_MODERATION_SCOPE_PUBLISHED;
    }

    if (normalizedValue === DASHBOARD_MODERATION_SCOPE_REJECTED) {
        return DASHBOARD_MODERATION_SCOPE_REJECTED;
    }

    return DASHBOARD_MODERATION_SCOPE_QUEUE;
}

/**
 * Reports whether the admin moderation surface is showing published events.
 */
function isPublishedModerationScope(scope) {
    return normalizeModerationScope(scope) === DASHBOARD_MODERATION_SCOPE_PUBLISHED;
}

/**
 * Reports whether the admin moderation surface is showing rejected events.
 */
function isRejectedModerationScope(scope) {
    return normalizeModerationScope(scope) === DASHBOARD_MODERATION_SCOPE_REJECTED;
}

/**
 * Reports whether the active moderation scope is an edit-only discovery list.
 */
function isEditOnlyModerationScope(scope) {
    return isPublishedModerationScope(scope) || isRejectedModerationScope(scope);
}

/**
 * Returns the API path used by the admin moderation surface for one scope.
 */
function readModerationEventSourcePath(scope) {
    if (isPublishedModerationScope(scope)) {
        return '/events';
    }

    if (isRejectedModerationScope(scope)) {
        return '/events/moderation?status=rejected';
    }

    return '/events/moderation?status=pending';
}

/**
 * Filters published discovery results down to events owned by other users.
 */
function filterAdminPublishedDiscoveryEvents(events, currentUserId, showOwnEvents = true) {
    const normalizedUserId = readText(currentUserId, '');

    return (Array.isArray(events) ? events : []).filter((event) => {
        const organizerId = readText(event?.organizerId, '');
        const normalizedStatus = String(event?.status || '').trim().toLowerCase();

        return normalizedStatus === 'published' && (showOwnEvents || organizerId !== normalizedUserId);
    });
}

/**
 * Filters rejected discovery results down to events owned by other users.
 */
function filterAdminRejectedDiscoveryEvents(events, currentUserId, showOwnEvents = true) {
    const normalizedUserId = readText(currentUserId, '');

    return (Array.isArray(events) ? events : []).filter((event) => {
        const organizerId = readText(event?.organizerId, '');
        const normalizedStatus = String(event?.status || '').trim().toLowerCase();

        return normalizedStatus === 'rejected' && (showOwnEvents || organizerId !== normalizedUserId);
    });
}

/**
 * Creates a metadata pill used by dashboard event cards.
 */
function createMetaPill(content, modifier = '') {
    const pill = document.createElement('span');
    pill.className = modifier
        ? `dashboard-meta-pill dashboard-meta-pill--${modifier}`
        : 'dashboard-meta-pill';

    if (typeof modifier === 'string' && modifier.trim()) {
        const iconElement = document.createElement('i');

        if (modifier === 'category') {
            iconElement.classList.add('fa-solid', 'fa-tag');
        } else if (modifier === 'date') {
            iconElement.classList.add('fa-solid', 'fa-calendar-days');
        } else {
            iconElement.classList.add('fa-solid', 'fa-location-dot');
        }

        iconElement.setAttribute('aria-hidden', 'true');
        pill.appendChild(iconElement);
    }

    pill.appendChild(content);
    return pill;
}

/**
 * Creates the compact category summary shown in dashboard event metadata.
 */
function createCategoryMetaContent(event) {
    const summary = Event.from(event).readTagSummary({ visibleCount: 1 });
    const label = summary.visibleTags[0]?.label || 'Outro';
    const content = document.createElement('span');
    content.textContent = summary.hiddenCount > 0 ? `${label} +${summary.hiddenCount}` : label;

    if (summary.hiddenCount > 0) {
        content.title = summary.hiddenTags.map(tag => tag.label).join(', ');
    }

    return content;
}

/**
 * Creates the dashboard date pill with an integrated full-date tooltip.
 */
function createDateMetaPill(event) {
    const eventRecord = Event.from(event);
    const pill = createMetaPill(document.createTextNode(eventRecord.formatDateTimePtBr()), 'date');

    new Tooltip({
        element: pill,
        content: eventRecord.formatDateTimeTooltipPtBr(),
        label: 'Ver data completa',
        useHostTrigger: true,
    });

    return pill;
}

/**
 * Creates one dashboard action button for manageable event cards.
 */
function createEventActionButton({ action, label, icon, modifier = '' } = {}) {
    const resolvedLabel = readText(label, 'Continuar');
    const classNames = ['button', 'button--ghost', 'dashboard-event__action-button'];
    const normalizedModifier = readText(modifier, '');

    if (normalizedModifier) {
        classNames.push(`dashboard-event__action-button--${normalizedModifier}`);
    }

    const button = new Button({
        element: document.createElement('button'),
        text: resolvedLabel,
        icon: readText(icon, '') || null,
        customClass: classNames,
        loadingLabel: resolvedLabel,
    });

    button.get().type = 'button';
    button.get().dataset.dashboardAction = readText(action, '');
    button.get().setAttribute('aria-label', resolvedLabel);
    return button.get();
}

/**
 * Returns the longer action guidance associated with one dashboard event card.
 */
function readOwnerActionHintText(statusMeta) {
    if (statusMeta.tone === 'success') {
        return 'Este evento já foi publicado. A partir daqui, apenas administradores podem editar ou excluir o envio.';
    }

    return statusMeta.tone === 'warning'
        ? 'Faça os ajustes necessários e reenvie o evento para moderação, ou exclua este envio se preferir começar de novo.'
        : 'Enquanto este envio não for publicado, você ainda pode editar ou excluir o evento.';
}

/**
 * Creates a compact help cue that reveals longer event action guidance.
 */
function createEventActionGuide({ content, label, customClass = '' } = {}) {
    const guide = document.createElement('div');
    guide.className = 'dashboard-event__action-guide';

    const tooltip = new Tooltip({
        content: readText(content, 'Ver orientações desta ação.'),
        label: readText(label, 'Ver orientações desta ação'),
        customClass: customClass || 'dashboard-event__action-tooltip',
    });

    guide.append(tooltip.get());
    return guide;
}

/**
 * Creates the owner-management toolbar attached to a manageable event card.
 */
function createOwnerEventActionToolbar(event, statusMeta) {
    const toolbar = document.createElement('div');
    toolbar.className = 'dashboard-event__toolbar';

    const actions = document.createElement('div');
    actions.className = 'dashboard-event__actions';
    if (canEditOwnEvent(event)) {
        actions.append(
            createEventActionButton({
            action: 'edit',
            label: 'Editar',
            icon: 'pen-to-square',
            modifier: 'edit',
            }),
        );
    }

    if (canDeleteOwnEvent(event)) {
        actions.append(
            createEventActionButton({
            action: 'delete',
            label: 'Excluir',
            icon: 'trash',
            modifier: 'danger',
            }),
        );
    }

    toolbar.append(createEventActionGuide({
        content: readOwnerActionHintText(statusMeta),
        label: 'Ver orientações deste envio',
        customClass: 'dashboard-event__action-tooltip',
    }), actions);
    return toolbar;
}

/**
 * Returns the moderation actions available for admin queue cards.
 */
function readModerationEventActionDefinitions({ scope = DASHBOARD_MODERATION_SCOPE_QUEUE } = {}) {
    if (isEditOnlyModerationScope(scope)) {
        return [
            {
                action: 'edit',
                label: 'Editar',
                icon: 'pen-to-square',
                modifier: 'edit',
            },
            {
                action: 'delete',
                label: 'Excluir',
                icon: 'trash',
                modifier: 'danger',
            },
        ];
    }

    return [
        {
            action: 'edit',
            label: 'Editar',
            icon: 'pen-to-square',
            modifier: 'edit',
        },
        {
            action: 'approve',
            label: 'Aprovar',
            icon: 'check',
            modifier: 'approve',
        },
        {
            action: 'reject',
            label: 'Rejeitar',
            icon: 'ban',
            modifier: 'danger',
        },
        {
            action: 'delete',
            label: 'Excluir',
            icon: 'trash',
            modifier: 'danger',
        },
    ];
}

/**
 * Creates the moderation toolbar attached to one pending admin queue card.
 */
function createModerationEventActionToolbar({ scope = DASHBOARD_MODERATION_SCOPE_QUEUE } = {}) {
    const toolbar = document.createElement('div');
    toolbar.className = 'dashboard-event__toolbar';

    const actions = document.createElement('div');
    actions.className = 'dashboard-event__actions';
    readModerationEventActionDefinitions({ scope }).forEach((actionDefinition) => {
        actions.appendChild(createEventActionButton(actionDefinition));
    });

    toolbar.append(createEventActionGuide({
        content: isPublishedModerationScope(scope)
            ? 'Use esta lista para localizar eventos já publicados. Você pode editar para devolver o evento à moderação ou excluir o envio definitivamente.'
            : (isRejectedModerationScope(scope)
                ? 'Use esta lista para localizar eventos rejeitados. Você pode editar para devolver o evento à moderação ou excluir o envio definitivamente.'
                : 'Edite para reenviar o evento ao fluxo de moderação, aprove para publicar imediatamente, rejeite com uma justificativa opcional ou exclua o envio.'),
        label: 'Ver orientações da moderação',
        customClass: 'dashboard-event__action-tooltip',
    }), actions);
    return toolbar;
}

/**
 * Dispatches one requested moderation action through the provided collaborators.
 */
async function handleModerationQueueActionRequest({
    requestedAction = '',
    managedEvent = null,
    isAdmin = false,
    isPendingModeration = false,
    allowDiscoveryEdit = false,
    openEdit = async () => {},
    openDelete = async () => {},
    approve = async () => {},
    openReject = async () => {},
    showToast = () => {},
} = {}) {
    if (!isAdmin) {
        showToast('Acesso restrito à fila de moderação.');
        return;
    }

    if (requestedAction === 'edit' && (isPendingModeration || allowDiscoveryEdit)) {
        await openEdit(managedEvent);
        return;
    }

    if (requestedAction === 'delete' && (isPendingModeration || allowDiscoveryEdit)) {
        await openDelete(managedEvent);
        return;
    }

    if (!isPendingModeration) {
        showToast('Somente eventos pendentes podem ser aprovados ou rejeitados por aqui.');
        return;
    }

    if (requestedAction === 'approve') {
        await approve(managedEvent);
        return;
    }

    if (requestedAction === 'reject') {
        await openReject(managedEvent);
    }
}

/**
 * Updates the local moderation list after an admin edit succeeds.
 */
function syncModerationEventsAfterAdminEdit(events, updatedEvent, {
    scope = DASHBOARD_MODERATION_SCOPE_QUEUE,
    previousEventId = null,
} = {}) {
    const normalizedUpdatedEventId = readText(updatedEvent?.id, '');
    const normalizedPreviousEventId = readText(previousEventId, '');
    const remainingEvents = (Array.isArray(events) ? events : []).filter((currentEvent) => {
        const currentEventId = readText(currentEvent?.id, '');

        return currentEventId !== normalizedUpdatedEventId
            && currentEventId !== normalizedPreviousEventId;
    });

    if (normalizeModerationScope(scope) === DASHBOARD_MODERATION_SCOPE_QUEUE && isPendingModerationEvent(updatedEvent)) {
        return Event.sortByDateDescending([updatedEvent, ...remainingEvents]);
    }

    return Event.sortByDateDescending(remainingEvents);
}

/**
 * Creates a highlighted moderation-feedback block for rejected events.
 */
function createModerationFeedbackElement(event) {
    const eventRecord = Event.from(event);
    const feedback = document.createElement('div');
    feedback.className = 'dashboard-event__feedback';

    const label = document.createElement('span');
    label.className = 'dashboard-event__feedback-label';
    label.textContent = 'Motivo da rejeição';

    const text = document.createElement('p');
    text.className = 'dashboard-event__feedback-text';
    text.textContent = eventRecord.readRejectionReason('O moderador devolveu este evento sem observações adicionais.');

    feedback.append(label, text);
    return feedback;
}

/**
 * Creates a rendered event card tailored for the active dashboard list.
 */
function createDashboardEventElement(event, {
    mode = DASHBOARD_VIEW_BROWSE,
    moderationScope = DASHBOARD_MODERATION_SCOPE_QUEUE,
} = {}) {
    const eventRecord = Event.from(event);
    const isPastEvent = eventRecord.isPast();
    const statusMeta = readStatusMeta(eventRecord.readStatus('pending'));
    const isModerationView = mode === DASHBOARD_VIEW_MODERATION;
    const isAdminDiscoveryView = isModerationView && isEditOnlyModerationScope(moderationScope);
    const isOwnerActionable = !isModerationView && (canEditOwnEvent(event) || canDeleteOwnEvent(event));
    const article = document.createElement('article');
    article.className = `dashboard-event dashboard-event--${statusMeta.tone}`;
    article.dataset.eventId = eventRecord.readId('');

    if (isPastEvent) {
        article.classList.add('dashboard-event--past');
    }

    const header = document.createElement('div');
    header.className = 'dashboard-event__header';

    const headline = document.createElement('div');
    headline.className = 'dashboard-event__headline';

    const title = document.createElement('h3');
    title.className = 'dashboard-event__title';
    title.textContent = eventRecord.readTitle('Evento sem título');

    const titleBlock = document.createElement('div');
    titleBlock.className = 'dashboard-event__title-block';
    titleBlock.appendChild(title);

    if (isModerationView) {
        const author = document.createElement('p');
        author.className = 'dashboard-event__author';
        author.textContent = eventRecord.readAuthorText();
        titleBlock.appendChild(author);
    }

    const statusGroup = document.createElement('div');
    statusGroup.className = 'dashboard-event__status-group';

    const tooltipPending = new Tooltip({
        content: statusMeta.note,
        label: `Status: ${statusMeta.label}`,
        icon: statusMeta.icon,
    });

    const statusPill = document.createElement('span');
    statusPill.className = `dashboard-status-pill dashboard-status-pill--${statusMeta.tone}`;
    statusPill.append(tooltipPending.get(), statusMeta.label);
    statusGroup.appendChild(statusPill);

    const timelineMeta = eventRecord.readTimelineMeta();
    const tooltipTimeline = new Tooltip({
        content: timelineMeta.tooltipContent,
        label: timelineMeta.tooltipLabel,
        icon: timelineMeta.icon,
    });

    const timelinePill = document.createElement('span');
    timelinePill.className = 'dashboard-status-pill dashboard-status-pill--neutral';
    timelinePill.append(tooltipTimeline.get(), timelineMeta.label);
    statusGroup.appendChild(timelinePill);

    headline.append(titleBlock, statusGroup);
    header.appendChild(headline);

    if (isAdminDiscoveryView) {
        header.appendChild(createModerationEventActionToolbar({ scope: moderationScope }));
    } else if (isModerationView && isPendingModerationEvent(event)) {
        header.appendChild(createModerationEventActionToolbar({ scope: moderationScope }));
    } else if (isOwnerActionable) {
        header.appendChild(createOwnerEventActionToolbar(event, statusMeta));
    }

    const description = document.createElement('p');
    description.className = 'dashboard-event__description';
    description.appendChild(createLinkedTextContent(
        eventRecord.readDescriptionSegments('Sem descrição.'),
        { linkClass: 'dashboard-event__description-link' },
    ));

    const meta = document.createElement('div');
    meta.className = 'dashboard-event__meta';
    meta.append(
        createMetaPill(createCategoryMetaContent(eventRecord), 'category'),
        createMetaPill(eventRecord.createLocationContent({
            fallback: 'A definir',
            linkClass: 'dashboard-meta-pill__link',
        }), 'location'),
        createDateMetaPill(eventRecord),
    );

    article.append(header, description);

    if (!isModerationView && statusMeta.tone === 'warning' && eventRecord.readRejectionReason()) {
        article.appendChild(createModerationFeedbackElement(eventRecord));
    }

    article.append(meta);

    return article;
}

class DashboardPage extends BaseComponent {
    #elements;
    #events = [];
    #moderationEvents = [];
    #moderationScope = DASHBOARD_MODERATION_SCOPE_QUEUE;
    #showPastFilterTooltip;
    #browseFilters = createDefaultDashboardBrowseFilters();
    #browseFiltersController;
    #eventFormModal;
    #deleteEventModal;
    #rejectEventModal;
    #currentEventPage = 1;
    #currentModerationPage = 1;
    #currentView = DASHBOARD_VIEW_BROWSE;
    #session = null;
    #header;
    #settingsPanels;
    #actionTabs;
    #pagination;

    /**
     * Creates the dashboard page controller around the page root.
     */
    constructor() {
        super(document.querySelector('#dashboard-root'));
        this.#elements = this.#collectElements();
        this.#eventFormModal = new DashboardEventFormModal({
            trigger: null,
        });
        this.#eventFormModal.onSubmitSuccess(async ({ event, mode, previousEventId }) => {
            await this.#syncEventsAfterSubmit({ event, mode, previousEventId });
        });
        this.#deleteEventModal = new DashboardDeleteEventModal();
        this.#deleteEventModal.onDeleteSuccess(async ({ eventId }) => {
            if (this.#currentView === DASHBOARD_VIEW_MODERATION) {
                await this.#syncModerationAfterDelete(eventId);
                return;
            }

            await this.#syncEventsAfterDelete(eventId);
        });
        this.#rejectEventModal = new DashboardRejectEventModal();
        this.#rejectEventModal.onRejectSuccess(async ({ event }) => {
            await this.#syncModerationAfterDecision(event);
        });
        this.#settingsPanels = new DashboardSettingsPanels({
            section: this.#elements.settingsSection,
        });
        this.#settingsPanels.onSessionChange(async ({ session }) => {
            this.#applySession(session);
        });
        this.#actionTabs = new DashboardActionTabs({
            tabList: this.#elements.actionTabList,
            tabs: this.#elements.actionTabs,
            onAction: async (tabName) => {
                return this.#handleActionTab(tabName);
            },
        });
        this.#actionTabs.wire().setActive('browse');
        this.#browseFiltersController = new DashboardFilters({
            root: this.#elements.eventsFilters,
            statusField: this.#elements.eventsFilterStatus,
            categoryField: this.#elements.eventsFilterCategory,
            showPastField: this.#elements.eventsFilterShowPast,
            orderField: this.#elements.eventsFilterOrder,
            onChange: (filters) => {
                this.#handleBrowseFilterChange(filters);
            },
        });
        this.#browseFiltersController.wire();
        this.#showPastFilterTooltip = this.#elements.eventsFilterShowPastTooltip
            ? new Tooltip({
                element: this.#elements.eventsFilterShowPastTooltip,
                label: 'Incluir eventos passados',
                icon: 'circle-info',
                customClass: 'dashboard-events-filters__tooltip',
            })
            : null;
        this.#pagination = new Pagination({
            container: this.#elements.eventsPagination,
            ariaLabel: 'Paginação dos eventos',
            pageSize: DASHBOARD_EVENTS_PER_PAGE,
        });
        this.#pagination.onPageChange(({ page }) => {
            const totalPages = this.#pagination.readPageCount(this.#readActiveEvents());
            const nextPage = this.#pagination.clampPage(page, totalPages);

            if (nextPage === this.#readCurrentListPage()) {
                return;
            }

            this.#setCurrentListPage(nextPage);
            this.#renderEventList();
            this.#elements.eventsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        this.on(this.#elements.eventsList, 'click', event => {
            void this.#handleEventListClick(event);
        });
        this.on(this.#elements.eventsFilterModerationScope, 'change', event => {
            void this.#handleModerationScopeChange(event);
        });

        if (this.#elements.eventsEmpty) {
            this.#elements.eventsEmpty.hidden = false;
            this.#elements.eventsEmpty.classList.add(DASHBOARD_HIDDEN_CLASS);
        }
    }

    /**
     * Boots the dashboard page once the required DOM is present.
     */
    async init() {
        if (!this.#isReady()) {
            return;
        }

        this.#header = new Header(true);
        const session = await this.#header.getSession();
        if (!session) {
            return;
        }

        if (!session.isAuthenticated) {
            if (!['missing-token', 'invalid-token'].includes(session.reason)) {
                this.#showToast(
                    session.message || 'Não foi possível validar a sua sessão agora.',
                    'error',
                    { group: DASHBOARD_STATUS_TOAST_GROUP },
                );
            }
            return;
        }

        this.#applySession(session, { render: false });
        Toast.dismissGroup(DASHBOARD_STATUS_TOAST_GROUP);
        this.#renderHeader();
        this.refreshEvents({ showErrors: true });
    }

    /**
     * Applies one authenticated session snapshot across dashboard collaborators.
     */
    #applySession(session, { render = true } = {}) {
        this.#session = session;
        this.#header?.setSession(session);
        this.#eventFormModal.setSession(session);
        this.#deleteEventModal.setSession(session);
        this.#rejectEventModal.setSession(session);
        this.#settingsPanels.setSession(session);

        if (this.#elements.userName) {
            this.#elements.userName.textContent = session?.user?.name || 'Usuário';
        }

        if (render) {
            this.#renderDashboardSections();
        }
    }

    /**
     * Reloads the current user's events and refreshes every dashboard section.
     */
    async refreshEvents({ showErrors = false } = {}) {
        if (!this.#session?.token) {
            return;
        }

        Toast.dismissGroup(DASHBOARD_STATUS_TOAST_GROUP);

        const response = await requestApi('/events/mine', {
            token: this.#session.token,
        });

        if (!response.ok) {
            this.#events = [];
            this.#renderDashboardSections();

            if (showErrors) {
                this.#showToast(
                    response.message || 'Não foi possível carregar os seus eventos no momento.',
                    'error',
                    { group: DASHBOARD_STATUS_TOAST_GROUP },
                );
            }

            return;
        }

        this.#events = Event.sortByDateDescending(response.data?.events || []);
        this.#currentEventPage = 1;
        this.#renderDashboardSections();
    }

    /**
     * Collects the DOM elements used throughout the dashboard lifecycle.
     */
    #collectElements() {
        const root = this.get();

        return {
            root,
            roleChip: root?.querySelector('#dashboard-role-chip') || null,
            userName: root?.querySelector('.dashboard-shell__user-name') || null,
            shellInstruction: root?.querySelector('#dashboard-shell-instruction') || null,
            actionTabList: root?.querySelector('[data-dashboard-action-tabs]') || null,
            actionTabs: Array.from(root?.querySelectorAll('[data-dashboard-action-tab]') || []),
            moderationTab: root?.querySelector('#dashboard-action-tab-moderation') || null,
            overviewBadge: root?.querySelector('#dashboard-overview-badge') || null,
            overviewNote: root?.querySelector('#dashboard-overview-note') || null,
            summaryGrid: root?.querySelector('#dashboard-summary-grid') || null,
            overviewSection: root?.querySelector('#dashboard-overview-section') || null,
            eventsSection: root?.querySelector('#dashboard-events-section') || null,
            settingsSection: root?.querySelector('#dashboard-settings-section') || null,
            eventsEyebrow: root?.querySelector('#dashboard-events-eyebrow') || null,
            eventsHeading: root?.querySelector('#dashboard-events-heading') || null,
            eventsDescription: root?.querySelector('#dashboard-events-description') || null,
            eventsBadge: root?.querySelector('#dashboard-events-badge') || null,
            eventsCaption: root?.querySelector('#dashboard-events-caption') || null,
            eventsFilters: root?.querySelector('#dashboard-events-filters') || null,
            eventsFilterStatusField: root?.querySelector('#dashboard-events-filter-status-field') || null,
            eventsFilterStatus: root?.querySelector('#dashboard-events-filter-status') || null,
            eventsFilterCategoryField: root?.querySelector('#dashboard-events-filter-category-field') || null,
            eventsFilterCategory: root?.querySelector('#dashboard-events-filter-category') || null,
            eventsFilterModerationScopeField: root?.querySelector('#dashboard-events-filter-moderation-scope-field') || null,
            eventsFilterModerationScope: root?.querySelector('#dashboard-events-filter-moderation-scope') || null,
            eventsFilterShowPastField: root?.querySelector('#dashboard-events-filter-show-past-field') || null,
            eventsFilterShowPast: root?.querySelector('.checkbox-field #filter-show-past') || null,
            eventsFilterShowPastTooltip: root?.querySelector('.checkbox-field[title]') || null,
            eventsFilterOrderField: root?.querySelector('#dashboard-events-filter-order-field') || null,
            eventsFilterOrder: root?.querySelector('#dashboard-events-filter-order') || null,
            eventsList: root?.querySelector('#dashboard-events-list') || null,
            eventsEmpty: root?.querySelector('#dashboard-events-empty') || null,
            eventsPagination: root?.querySelector('#dashboard-events-pagination') || null,
            createToggle: root?.querySelector('#dashboard-create-toggle') || null,
            settingsButton: root?.querySelector('#dashboard-settings-button') || null,
        };
    }

    /**
     * Reports whether the dashboard has every required element to boot.
     */
    #isReady() {
        return Boolean(
            super.isReady()
            && this.#elements.actionTabs.length >= 3
            && this.#elements.overviewSection
            && this.#elements.summaryGrid
            && this.#elements.eventsSection
            && this.#elements.settingsSection
            && this.#elements.eventsList
            && this.#elements.eventsEmpty
        );
    }

    /**
     * Looks up one event by id inside the current dashboard state.
     */
    #findActiveEventById(eventId) {
        const normalizedEventId = readText(eventId, '');
        return this.#readActiveEvents().find(event => event.id === normalizedEventId) || null;
    }

    /**
     * Scrolls one dashboard section into view and focuses its summary.
     */
    #focusSection(section) {
        if (!section) {
            return;
        }

        section.open = true;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section.querySelector('.dashboard-section__summary')?.focus();
    }

    /**
     * Runs the direct action associated with one dashboard subheader tab.
     */
    async #handleActionTab(tabName) {
        if (tabName === DASHBOARD_VIEW_MODERATION) {
            if (!this.#isAdmin()) {
                return this.#currentView;
            }

            this.#currentView = DASHBOARD_VIEW_MODERATION;
            this.#renderDashboardSections();
            await this.refreshModerationEvents({ showErrors: true });
            this.#focusSection(this.#elements.eventsSection);
            return this.#currentView;
        }

        if (tabName === 'create') {
            try {
                await this.#eventFormModal.open();
            } catch {
                this.#showToast(
                    'Não foi possível abrir o formulário do evento agora.',
                    'error',
                    { group: DASHBOARD_STATUS_TOAST_GROUP },
                );
            }
            return this.#currentView;
        }

        if (tabName === 'settings') {
            this.#currentView = DASHBOARD_VIEW_SETTINGS;
            this.#renderDashboardSections();
            this.#settingsPanels.focus();
            return this.#currentView;
        }

        this.#currentView = DASHBOARD_VIEW_BROWSE;
        this.#renderDashboardSections();
        await this.refreshEvents({ showErrors: true });

        if (this.#elements.overviewSection) {
            this.#elements.overviewSection.open = true;
        }

        if (this.#elements.eventsSection) {
            this.#elements.eventsSection.open = true;
        }

        this.#focusSection(this.#elements.overviewSection);
        return this.#currentView;
    }

    /**
     * Synchronizes dashboard sections after the create or edit modal succeeds.
     */
    async #syncEventsAfterSubmit({ event, mode, previousEventId } = {}) {
        if (!event?.id) {
            await this.refreshEvents();
            return;
        }

        const normalizedMode = readText(mode, 'create').toLowerCase();

        if (this.#currentView === DASHBOARD_VIEW_MODERATION && normalizedMode === 'edit') {
            this.#moderationEvents = syncModerationEventsAfterAdminEdit(this.#moderationEvents, event, {
                scope: this.#moderationScope,
                previousEventId,
            });
            this.#syncModerationPage();
            this.#renderDashboardSections();
            this.#actionTabs.setActive(this.#currentView);
            return;
        }

        const nextEvents = this.#events.filter((currentEvent) => {
            if (normalizedMode === 'edit' && previousEventId) {
                return currentEvent.id !== previousEventId;
            }

            return currentEvent.id !== event.id;
        });

        this.#events = Event.sortByDateDescending([event, ...nextEvents]);
        this.#currentEventPage = 1;
        this.#renderDashboardSections();
        this.#actionTabs.setActive(this.#currentView);
    }

    /**
     * Synchronizes dashboard sections after a successful delete action.
     */
    async #syncEventsAfterDelete(eventId) {
        const normalizedEventId = readText(eventId, '');
        if (!normalizedEventId) {
            await this.refreshEvents();
            return;
        }

        this.#events = this.#events.filter(event => event.id !== normalizedEventId);
        this.#syncBrowsePage();
        this.#renderDashboardSections();
        this.#actionTabs.setActive(this.#currentView);
    }

    /**
     * Synchronizes the moderation queue after an approve or reject action succeeds.
     */
    async #syncModerationAfterDecision(event) {
        const moderatedEventId = readText(event?.id, '');

        if (!moderatedEventId) {
            await this.refreshModerationEvents({ showErrors: false });
            return;
        }

        this.#moderationEvents = this.#moderationEvents.filter(currentEvent => currentEvent.id !== moderatedEventId);
        this.#syncModerationPage();
        this.#renderDashboardSections();
        this.#actionTabs.setActive(this.#currentView);
    }

    /**
     * Synchronizes the moderation list after a successful admin delete.
     */
    async #syncModerationAfterDelete(eventId) {
        const normalizedEventId = readText(eventId, '');
        if (!normalizedEventId) {
            await this.refreshModerationEvents({ showErrors: false });
            return;
        }

        this.#moderationEvents = this.#moderationEvents.filter(event => event.id !== normalizedEventId);
        this.#syncModerationPage();
        this.#renderDashboardSections();
        this.#actionTabs.setActive(this.#currentView);
    }

    /**
     * Handles edit and delete clicks dispatched from the event list.
     */
    async #handleEventListClick(domEvent) {
        const actionButton = domEvent.target instanceof Element
            ? domEvent.target.closest('[data-dashboard-action]')
            : null;

        if (!actionButton || !this.#elements.eventsList?.contains(actionButton)) {
            return;
        }

        const requestedAction = readText(actionButton.dataset.dashboardAction, '');
        const eventCard = actionButton.closest('[data-event-id]');
        const managedEvent = this.#findActiveEventById(eventCard?.dataset.eventId);

        if (!managedEvent) {
            return;
        }

        if (this.#currentView === DASHBOARD_VIEW_MODERATION) {
            await this.#handleModerationEventAction(requestedAction, managedEvent, eventCard, actionButton);
            return;
        }

        try {
            if (requestedAction === 'edit') {
                if (!canEditOwnEvent(managedEvent)) {
                    this.#showToast(
                        'Apenas eventos pendentes ou rejeitados podem ser editados por aqui.',
                        'error',
                        { group: DASHBOARD_STATUS_TOAST_GROUP },
                    );
                    return;
                }

                await this.#eventFormModal.open({ event: managedEvent });
                return;
            }

            if (requestedAction === 'delete') {
                if (!canDeleteOwnEvent(managedEvent)) {
                    this.#showToast(
                        'Apenas eventos pendentes ou rejeitados podem ser excluídos por aqui.',
                        'error',
                        { group: DASHBOARD_STATUS_TOAST_GROUP },
                    );
                    return;
                }

                await this.#deleteEventModal.open({ event: managedEvent });
            }
        } catch {
            this.#showToast(
                'Não foi possível abrir essa ação agora.',
                'error',
                { group: DASHBOARD_STATUS_TOAST_GROUP },
            );
        }
    }

    /**
     * Updates the current browse-list state after the shared filter component changes.
     */
    #handleBrowseFilterChange(filters) {
        if (this.#currentView !== DASHBOARD_VIEW_BROWSE) {
            return;
        }

        this.#browseFilters = filters;
        this.#currentEventPage = 1;
        this.#renderEventList();
    }

    /**
     * Updates the moderation discovery scope after the admin selector changes.
     */
    async #handleModerationScopeChange(domEvent) {
        const target = domEvent.target instanceof HTMLSelectElement
            ? domEvent.target
            : null;

        if (!target || target !== this.#elements.eventsFilterModerationScope || this.#currentView !== DASHBOARD_VIEW_MODERATION) {
            return;
        }

        const nextScope = normalizeModerationScope(target.value);

        if (nextScope === this.#moderationScope) {
            return;
        }

        this.#moderationScope = nextScope;
        this.#currentModerationPage = 1;
        await this.refreshModerationEvents({ showErrors: true });
    }

    /**
     * Handles edit, approve, and reject actions dispatched from the moderation list.
     */
    async #handleModerationEventAction(requestedAction, managedEvent, eventCard, actionButton) {
        try {
            await handleModerationQueueActionRequest({
                requestedAction,
                managedEvent,
                isAdmin: this.#isAdmin(),
                isPendingModeration: isPendingModerationEvent(managedEvent),
                allowDiscoveryEdit: isEditOnlyModerationScope(this.#moderationScope),
                openEdit: async (event) => {
                    await this.#eventFormModal.open({
                        event,
                        allowAdminEdit: true,
                    });
                },
                openDelete: async (event) => {
                    await this.#deleteEventModal.open({
                        event,
                        allowAdminDelete: true,
                    });
                },
                approve: async (event) => {
                    const approveButton = actionButton instanceof HTMLButtonElement
                        ? new Button({ element: actionButton })
                        : null;

                    try {
                        approveButton?.setLoadingLabel('Aprovando...');
                        approveButton?.disable({ showBusy: true });
                        await this.#approveEvent(event, eventCard);
                    } finally {
                        approveButton?.enable();
                    }
                },
                openReject: async (event) => {
                    await this.#rejectEventModal.open({ event });
                },
                showToast: (text) => {
                    this.#showToast(text, 'error', {
                        group: DASHBOARD_STATUS_TOAST_GROUP,
                    });
                },
            });
        } catch {
            this.#showToast(
                'Não foi possível abrir essa ação de moderação agora.',
                'error',
                { group: DASHBOARD_STATUS_TOAST_GROUP },
            );
        }
    }

    /**
     * Publishes one pending event directly from the moderation queue.
     */
    async #approveEvent(event, eventCard) {
        if (!this.#session?.token) {
            this.#showToast(
                'Não foi possível validar a sua sessão agora.',
                'error',
                { group: DASHBOARD_STATUS_TOAST_GROUP },
            );
            return;
        }

        this.#setEventCardActionsDisabled(eventCard, true);

        try {
            const response = await requestApi(`/events/${event.id}/moderation`, {
                method: 'PUT',
                token: this.#session.token,
                body: { status: 'published' },
            });

            if (!response.ok) {
                this.#showToast(
                    response.message || 'Não foi possível aprovar o evento agora.',
                    'error',
                    { group: DASHBOARD_STATUS_TOAST_GROUP },
                );
                return;
            }

            await this.#syncModerationAfterDecision(response.data?.event || event);
            this.#showToast(
                response.message || 'Evento aprovado e publicado.',
                'success',
                { group: DASHBOARD_ACTION_TOAST_GROUP },
            );
        } finally {
            this.#setEventCardActionsDisabled(eventCard, false);
        }
    }

    /**
     * Renders every dashboard section driven by the current state snapshot.
     */
    #renderDashboardSections() {
        this.#renderHeader();
        this.#renderOverview();
        this.#renderEventList();
        this.#renderSettingsSection();
    }

    /**
     * Updates the account chip using the current session state.
     */
    #renderHeader() {
        if (this.#elements.roleChip) {
            this.#elements.roleChip.textContent = readRoleLabel(this.#session?.user?.role);
        }

        if (this.#elements.shellInstruction) {
            this.#elements.shellInstruction.textContent = readDashboardShellInstruction(this.#session?.user?.role);
        }

        if (this.#elements.moderationTab) {
            this.#elements.moderationTab.hidden = !this.#isAdmin();
        }
    }

    /**
     * Renders the overview cards and the section badge.
     */
    #renderOverview() {
        const isListHidden = this.#currentView === DASHBOARD_VIEW_MODERATION
            || this.#currentView === DASHBOARD_VIEW_SETTINGS;

        if (this.#elements.overviewSection) {
            this.#elements.overviewSection.hidden = isListHidden;
        }

        if (isListHidden) {
            return;
        }

        const cards = createSummaryCards(this.#events);
        const fragment = document.createDocumentFragment();

        cards.forEach((card) => {
            fragment.appendChild(createSummaryCardElement(card));
        });

        this.#elements.summaryGrid.replaceChildren(fragment);

        if (this.#elements.overviewBadge) {
            this.#elements.overviewBadge.textContent = formatCount(this.#events.length, 'envio', 'envios');
        }

        if (this.#elements.overviewNote) {
            const pendingCount = countEvents(this.#events, event => readStatusMeta(event?.status).tone === 'pending');
            const pendingSummary = pendingCount === 1
                ? '1 envio está aguardando aprovação'
                : `${pendingCount} envios estão aguardando aprovação`;

            this.#elements.overviewNote.textContent = this.#events.length === 0
                ? 'Assim que você criar o primeiro evento, os indicadores de moderação e agenda começam a aparecer aqui.'
                : (pendingCount > 0
                    ? `${pendingSummary} no momento.`
                    : 'Você não tem envios pendentes agora. Use este painel para acompanhar os próximos movimentos da conta.');
        }
    }

    /**
     * Renders the current user's event list and empty state.
     */
    #renderEventList() {
        const isSettingsView = this.#currentView === DASHBOARD_VIEW_SETTINGS;

        if (this.#elements.eventsSection) {
            this.#elements.eventsSection.hidden = isSettingsView;
        }

        if (isSettingsView) {
            return;
        }

        const sectionCopy = readEventSectionCopy(this.#currentView, {
            moderationScope: this.#moderationScope,
        });
        const isBrowseView = this.#currentView === DASHBOARD_VIEW_BROWSE;
        this.#renderEventFilters();
        this.#syncCurrentListPage();
        const activeEvents = this.#readActiveEvents();

        if (this.#elements.eventsEyebrow) {
            this.#elements.eventsEyebrow.textContent = sectionCopy.eyebrow;
        }

        if (this.#elements.eventsHeading) {
            this.#elements.eventsHeading.textContent = sectionCopy.heading;
        }

        if (this.#elements.eventsDescription) {
            this.#elements.eventsDescription.textContent = sectionCopy.description;
        }

        if (this.#elements.eventsBadge) {
            this.#elements.eventsBadge.textContent = isBrowseView
                ? formatDashboardBrowseBadge(activeEvents.length, this.#events.length)
                : formatCount(
                    activeEvents.length,
                    sectionCopy.badgeSingular,
                    sectionCopy.badgePlural,
                );
        }

        if (this.#elements.eventsCaption) {
            this.#elements.eventsCaption.textContent = isBrowseView
                ? readDashboardBrowseCaption(activeEvents.length, this.#events.length, this.#browseFilters, sectionCopy)
                : (activeEvents.length > 0
                    ? sectionCopy.populatedCaption
                    : sectionCopy.emptyCaption);
        }

        if (this.#elements.eventsEmpty) {
            this.#elements.eventsEmpty.textContent = isBrowseView
                ? readDashboardBrowseEmptyState(activeEvents.length, this.#events.length, this.#browseFilters, sectionCopy)
                : sectionCopy.emptyState;
        }

        if (activeEvents.length === 0) {
            this.#elements.eventsList.replaceChildren();
            this.#elements.eventsEmpty.hidden = false;
            this.#elements.eventsEmpty?.classList.remove(DASHBOARD_HIDDEN_CLASS);
            this.#renderEventPagination();
            return;
        }

        const fragment = document.createDocumentFragment();
        this.#pagination.readPageItems(activeEvents, this.#readCurrentListPage()).forEach((event) => {
            fragment.appendChild(createDashboardEventElement(event, {
                mode: this.#currentView,
                moderationScope: this.#moderationScope,
            }));
        });

        this.#elements.eventsList.replaceChildren(fragment);
        this.#elements.eventsEmpty.hidden = true;
        this.#elements.eventsEmpty?.classList.add(DASHBOARD_HIDDEN_CLASS);
        this.#renderEventPagination();
    }

    /**
     * Shows or hides the owner-event filters and synchronizes their values.
     */
    #renderEventFilters() {
        if (!this.#elements.eventsFilters) {
            return;
        }

        const isBrowseView = this.#currentView === DASHBOARD_VIEW_BROWSE;
        const isModerationView = this.#currentView === DASHBOARD_VIEW_MODERATION && this.#isAdmin();
        this.#elements.eventsFilters.hidden = !isBrowseView && !isModerationView;

        [
            this.#elements.eventsFilterStatusField,
            this.#elements.eventsFilterCategoryField,
            this.#elements.eventsFilterOrderField,
            this.#elements.eventsFilterShowPastField,
        ].forEach((element) => {
            if (element) {
                element.hidden = !isBrowseView;
            }
        });

        if (this.#elements.eventsFilterModerationScopeField) {
            this.#elements.eventsFilterModerationScopeField.hidden = !isModerationView;
        }

        if (isModerationView) {
            if (this.#elements.eventsFilterModerationScope) {
                this.#elements.eventsFilterModerationScope.value = this.#moderationScope;
            }

            return;
        }

        if (!isBrowseView) {
            return;
        }

        this.#browseFilters = this.#browseFiltersController.render({
            events: this.#events,
            filters: this.#browseFilters,
        });
    }

    /**
     * Keeps the current dashboard event page inside the valid range.
     */
    #syncCurrentListPage() {
        if (this.#currentView === DASHBOARD_VIEW_MODERATION) {
            this.#syncModerationPage();
            return;
        }

        this.#syncBrowsePage();
    }

    /**
     * Renders the pager summary and controls for the current event slice.
     */
    #renderEventPagination() {
        const activeEvents = this.#readActiveEvents();
        this.#pagination.render({
            items: activeEvents,
            currentPage: this.#readCurrentListPage(),
        });
    }

    /**
     * Shows or hides the inline settings area for the current dashboard view.
     */
    #renderSettingsSection() {
        if (!this.#elements.settingsSection) {
            return;
        }

        const isSettingsView = this.#currentView === DASHBOARD_VIEW_SETTINGS;
        this.#elements.settingsSection.hidden = !isSettingsView;

        if (isSettingsView) {
            this.#elements.settingsSection.open = true;
        }
    }

    /**
     * Reloads the moderation queue visible to administrators.
     */
    async refreshModerationEvents({ showErrors = false } = {}) {
        if (!this.#session?.token || !this.#isAdmin()) {
            this.#moderationEvents = [];
            this.#currentModerationPage = 1;
            this.#renderDashboardSections();
            return;
        }

        const response = await requestApi(readModerationEventSourcePath(this.#moderationScope), {
            token: this.#session.token,
        });

        if (!response.ok) {
            this.#moderationEvents = [];
            this.#currentModerationPage = 1;
            this.#renderDashboardSections();

            if (showErrors) {
                const errorMessage = isPublishedModerationScope(this.#moderationScope)
                    ? 'Não foi possível carregar os eventos publicados para edição administrativa no momento.'
                    : (isRejectedModerationScope(this.#moderationScope)
                        ? 'Não foi possível carregar os eventos rejeitados para edição administrativa no momento.'
                        : 'Não foi possível carregar a fila de moderação no momento.');

                this.#showToast(
                    response.message || errorMessage,
                    'error',
                    { group: DASHBOARD_STATUS_TOAST_GROUP },
                );
            }

            return;
        }

        const loadedEvents = response.data?.events || [];
        const moderationEvents = isPublishedModerationScope(this.#moderationScope)
            ? filterAdminPublishedDiscoveryEvents(loadedEvents, this.#session?.user?.id)
            : (isRejectedModerationScope(this.#moderationScope)
                ? filterAdminRejectedDiscoveryEvents(loadedEvents, this.#session?.user?.id)
                : loadedEvents);

        this.#moderationEvents = Event.sortByDateDescending(moderationEvents);
        this.#currentModerationPage = 1;
        this.#renderDashboardSections();
    }

    /**
     * Reports whether the active session belongs to an administrator.
     */
    #isAdmin() {
        return isAdminRole(this.#session?.user?.role);
    }

    /**
     * Returns the list associated with the active dashboard view.
     */
    #readActiveEvents() {
        return this.#currentView === DASHBOARD_VIEW_MODERATION
            ? this.#moderationEvents
            : this.#readBrowseEvents();
    }

    /**
     * Returns the current owner-event slice after the active browse filters are applied.
     */
    #readBrowseEvents() {
        return filterDashboardBrowseEvents(this.#events, this.#browseFilters);
    }

    /**
     * Returns the current page for the active dashboard list.
     */
    #readCurrentListPage() {
        return this.#currentView === DASHBOARD_VIEW_MODERATION
            ? this.#currentModerationPage
            : this.#currentEventPage;
    }

    /**
     * Stores the current page for the active dashboard list.
     */
    #setCurrentListPage(page) {
        if (this.#currentView === DASHBOARD_VIEW_MODERATION) {
            this.#currentModerationPage = page;
            return;
        }

        this.#currentEventPage = page;
    }

    /**
     * Keeps the owner-event page inside the valid browse range.
     */
    #syncBrowsePage() {
        const totalPages = this.#pagination.readPageCount(this.#readBrowseEvents());
        this.#currentEventPage = this.#pagination.clampPage(this.#currentEventPage, totalPages);
    }

    /**
     * Keeps the moderation page inside the valid queue range.
     */
    #syncModerationPage() {
        const totalPages = this.#pagination.readPageCount(this.#moderationEvents);
        this.#currentModerationPage = this.#pagination.clampPage(this.#currentModerationPage, totalPages);
    }

    /**
     * Enables or disables every action button rendered inside one event card.
     */
    #setEventCardActionsDisabled(eventCard, disabled) {
        eventCard?.querySelectorAll('[data-dashboard-action]').forEach((button) => {
            button.disabled = Boolean(disabled);
        });
    }

    /**
     * Emits a shared toast for dashboard status changes.
     */
    #showToast(text, tone = 'info', options = {}) {
        const normalizedText = readText(text, '');
        if (!normalizedText) {
            return null;
        }

        return Toast.show(normalizedText, {
            tone,
            group: options.group,
            duration: options.duration ?? (tone === 'success' ? 4400 : 6000),
        });
    }
}

new DashboardPage().init();
