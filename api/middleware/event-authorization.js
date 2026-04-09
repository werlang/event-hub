import { HttpError } from '../helpers/error.js';
import { Event } from '../model/event.js';

/**
 * Ensures the target event exists and belongs to the authenticated owner.
 */
function assertOwnedEvent(event, user) {
    if (!event) {
        throw new HttpError(404, 'Evento não encontrado.');
    }

    if (event.organizerId !== user?.id) {
        throw new HttpError(403, 'Você não tem permissão para gerenciar este evento.');
    }
}

/**
 * Ensures the authenticated owner can still edit the target event.
 */
export function assertOwnerCanEditEvent(event, user) {
    assertOwnedEvent(event, user);

    if (!Event.canOwnerEditStatus(event.status)) {
        throw new HttpError(403, 'Somente eventos pendentes ou rejeitados podem ser editados.');
    }
}

/**
 * Ensures the authenticated owner can still delete the target event.
 */
export function assertOwnerCanDeleteEvent(event, user) {
    assertOwnedEvent(event, user);

    if (!Event.canOwnerDeleteStatus(event.status)) {
        throw new HttpError(403, 'Somente eventos pendentes ou rejeitados podem ser excluídos.');
    }
}

/**
 * Ensures the authenticated owner can still manage the target event through the legacy delete-oriented contract.
 */
export function assertOwnerCanManageEvent(event, user) {
    assertOwnerCanDeleteEvent(event, user);
}

/**
 * Ensures the authenticated administrator can moderate the target event.
 */
export function assertAdminCanModerateEvent(event, user, { allowSelfModeration = false } = {}) {
    if (!event) {
        throw new HttpError(404, 'Evento não encontrado.');
    }

    if (event.organizerId === user?.id && !allowSelfModeration) {
        throw new HttpError(403, 'Administradores não podem moderar os próprios eventos.');
    }

    if (Event.isPublishedStatus(event.status)) {
        throw new HttpError(400, 'Somente eventos não publicados podem ser moderados.');
    }
}