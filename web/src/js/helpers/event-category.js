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
 * Returns one non-empty text value suitable for UI rendering.
 */
function readText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Converts one raw category id into a readable fallback label.
 */
function humanizeCategoryLabel(value) {
    const normalizedValue = readText(value);
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
 * Resolves one stored category value into canonical id and label metadata.
 */
export function readEventCategoryMeta(value, { fallbackId = 'outro', fallbackLabel = 'Outro' } = {}) {
    const entry = findEventCategoryEntry(value);
    if (entry) {
        return {
            id: entry.id,
            label: entry.label,
        };
    }

    const normalizedValue = readText(value);
    return {
        id: normalizedValue || fallbackId,
        label: humanizeCategoryLabel(normalizedValue) || fallbackLabel,
    };
}

/**
 * Resolves one incoming tag payload into a UI-ready tag object.
 */
function readResolvedTag(tag) {
    if (typeof tag === 'string') {
        const category = readEventCategoryMeta(tag, { fallbackId: '', fallbackLabel: '' });
        return category.label ? category : null;
    }

    if (!tag || typeof tag !== 'object') {
        return null;
    }

    const directLabel = readText(tag.label) || readText(tag.name) || readText(tag.title);
    const directId = readText(tag.id) || readText(tag.value) || readText(tag.slug) || readText(tag.categoryId);

    if (directLabel) {
        return {
            id: directId || directLabel,
            label: directLabel,
        };
    }

    const category = readEventCategoryMeta(directId, { fallbackId: '', fallbackLabel: '' });
    return category.label ? category : null;
}

/**
 * Returns a deduplicated tag summary for one event payload.
 */
export function readEventTagSummary(event, { visibleCount = 2 } = {}) {
    const sourceTags = Array.isArray(event?.tags) && event.tags.length > 0
        ? event.tags
        : [{ id: event?.category, label: event?.categoryLabel }];

    const tags = [];
    const seenLabels = new Set();

    sourceTags.forEach((tag) => {
        const resolvedTag = readResolvedTag(tag);
        const normalizedLabel = normalizeCategoryLookupKey(resolvedTag?.label);
        if (!resolvedTag || !normalizedLabel || seenLabels.has(normalizedLabel)) {
            return;
        }

        seenLabels.add(normalizedLabel);
        tags.push(resolvedTag);
    });

    return {
        tags,
        visibleTags: tags.slice(0, Math.max(1, visibleCount)),
        hiddenTags: tags.slice(Math.max(1, visibleCount)),
        hiddenCount: Math.max(0, tags.length - Math.max(1, visibleCount)),
    };
}