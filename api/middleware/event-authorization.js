import { HttpError } from '../helpers/error.js';
import { Event } from '../model/event.js';

/**
 * Ensures the authenticated owner can still manage the target event.
 */
export function assertOwnerCanManageEvent(event, user) {
    if (!event) {
        throw new HttpError(404, 'Evento não encontrado.');
    }

    if (event.organizerId !== user?.id) {
        throw new HttpError(403, 'Você não tem permissão para gerenciar este evento.');
    }

    if (!Event.canOwnerManageStatus(event.status)) {
        throw new HttpError(403, 'Somente eventos pendentes ou rejeitados podem ser editados ou excluídos.');
    }
}

/**
 * Ensures the authenticated administrator can moderate the target event.
 */
export function assertAdminCanModerateEvent(event, user) {
    if (!event) {
        throw new HttpError(404, 'Evento não encontrado.');
    }

    if (event.organizerId === user?.id) {
        throw new HttpError(403, 'Administradores não podem moderar os próprios eventos.');
    }

    if (Event.isPublishedStatus(event.status)) {
        throw new HttpError(400, 'Somente eventos não publicados podem ser moderados.');
    }
}