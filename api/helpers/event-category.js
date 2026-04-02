const EVENT_CATEGORY_ENTRIES = Object.freeze([
    {
        id: 'reuniao',
        label: 'Reunião Interna',
        aliases: ['reuniao', 'reunião', 'reuniao interna', 'reunião interna'],
    },
    {
        id: 'academico',
        label: 'Evento Acadêmico',
        aliases: ['academico', 'acadêmico', 'evento academico', 'evento acadêmico'],
    },
    {
        id: 'extensao',
        label: 'Extensão e Parceria',
        aliases: ['extensao', 'extensão', 'extensao e parceria', 'extensão e parceria'],
    },
    {
        id: 'representacao',
        label: 'Representação Institucional',
        aliases: ['representacao', 'representação', 'representacao institucional', 'representação institucional'],
    },
    {
        id: 'outro',
        label: 'Outro',
        aliases: ['outro', 'geral'],
    },
]);

/**
 * Normalizes one category value into a lookup-safe key.
 */
function normalizeCategoryLookupKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

/**
 * Converts one raw category id into a readable fallback label.
 */
function humanizeCategoryLabel(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return '';
    }

    return normalizedValue
        .replace(/[_-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Finds a known event category entry from an id, label, or alias.
 */
function findEventCategoryEntry(value) {
    const lookupKey = normalizeCategoryLookupKey(value);
    if (!lookupKey) {
        return null;
    }

    return EVENT_CATEGORY_ENTRIES.find(entry => {
        const knownValues = [entry.id, entry.label, ...(entry.aliases || [])];
        return knownValues.some(candidate => normalizeCategoryLookupKey(candidate) === lookupKey);
    }) || null;
}

/**
 * Returns the canonical category id stored by the API.
 */
export function normalizeEventCategoryId(value, { fallback = 'outro' } = {}) {
    const entry = findEventCategoryEntry(value);
    if (entry) {
        return entry.id;
    }

    const normalizedValue = String(value || '').trim();
    return normalizedValue || fallback;
}

/**
 * Returns the user-facing category label for one stored category value.
 */
export function readEventCategoryLabel(value, { fallback = 'Outro' } = {}) {
    const entry = findEventCategoryEntry(value);
    if (entry) {
        return entry.label;
    }

    return humanizeCategoryLabel(value) || fallback;
}