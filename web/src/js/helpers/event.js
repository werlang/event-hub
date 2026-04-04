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
	* Returns one trimmed text value or an empty string.
	*/
function readText(value) {
	return typeof value === 'string' ? value.trim() : '';
}

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

	return EVENT_CATEGORY_ENTRIES.find((entry) => {
		const knownValues = [entry.id, entry.label, ...(entry.aliases || [])];
		return knownValues.some((candidate) => normalizeCategoryLookupKey(candidate) === lookupKey);
	}) || null;
}

/**
	* Reports whether a value stores only a calendar day.
	*/
function isDateOnlyValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
	* Reports whether a value represents a date-only payload normalized to midnight UTC.
	*/
function isDateOnlyIsoValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value);
}

/**
	* Converts a normalized YYYY-MM-DD value into a local Date instance.
	*/
function createLocalDate(value) {
	const [yearText, monthText, dayText] = String(value).split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
	* Extracts the normalized YYYY-MM-DD token from a supported date-only value.
	*/
function readDateOnlyDay(value) {
	if (isDateOnlyValue(value)) {
		return value;
	}

	if (isDateOnlyIsoValue(value)) {
		return value.slice(0, 10);
	}

	return null;
}

/**
	* Converts a date-only string into a local timestamp.
	*/
function toLocalDateOnlyTimestamp(value) {
	const [yearText, monthText, dayText] = String(value).split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
		return Number.POSITIVE_INFINITY;
	}

	return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

/**
	* Converts a date-like value into a comparable timestamp.
	*/
function toTimestamp(value) {
	const dateOnlyDay = readDateOnlyDay(value);
	if (dateOnlyDay) {
		return toLocalDateOnlyTimestamp(dateOnlyDay);
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

/**
	* Converts an event date into a day-level sort key.
	*/
function toDayKey(value) {
	const dateOnlyDay = readDateOnlyDay(value);
	if (dateOnlyDay) {
		return dateOnlyDay;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return '9999-12-31';
	}

	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
	* Normalizes a location string into a valid HTTP(S) URL when possible.
	*/
function readLocationHref(value) {
	const normalizedValue = readText(value);
	if (!normalizedValue) {
		return '';
	}

	const candidateValue = /^https?:\/\//i.test(normalizedValue)
		? normalizedValue
		: (/^www\./i.test(normalizedValue) ? `https://${normalizedValue}` : '');

	if (!candidateValue) {
		return '';
	}

	try {
		const locationUrl = new URL(candidateValue);
		return /^https?:$/i.test(locationUrl.protocol) ? locationUrl.toString() : '';
	} catch {
		return '';
	}
}

/**
	* Returns a compact hostname label for one external location link.
	*/
function readHostnameLabel(url) {
	const hostname = readText(url?.hostname).replace(/^www\./i, '');
	return hostname || 'link externo';
}

/**
	* Returns the best user-facing label for one external location link.
	*/
function readLocationLinkLabel(url) {
	const hostname = readHostnameLabel(url);
	const normalizedHostname = hostname.toLowerCase();
	const normalizedPathname = readText(url?.pathname) || '/';
	const pathname = normalizedPathname.toLowerCase();

	if (
		normalizedHostname.includes('maps.google')
		|| normalizedHostname.includes('waze')
		|| normalizedHostname.includes('openstreetmap')
		|| normalizedHostname.includes('apple.com')
		|| pathname.startsWith('/maps')
	) {
		return 'Abrir mapa';
	}

	if (
		normalizedHostname.includes('meet.google')
		|| normalizedHostname.includes('zoom.us')
		|| normalizedHostname.includes('teams.microsoft')
		|| normalizedHostname.includes('webex')
	) {
		return 'Abrir sala online';
	}

	return `Abrir em ${hostname}`;
}

/**
	* Resolves one incoming tag payload into a UI-ready tag object.
	*/
function readResolvedTag(tag) {
	if (typeof tag === 'string') {
		const category = Event.readCategoryMeta(tag, { fallbackId: '', fallbackLabel: '' });
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

	const category = Event.readCategoryMeta(directId, { fallbackId: '', fallbackLabel: '' });
	return category.label ? category : null;
}

export class Event {
	#data;

	/**
	 * Creates a reusable event record wrapper around one raw payload.
	 */
	constructor(data = {}) {
		if (data instanceof Event) {
			this.#data = data.toJSON();
			return;
		}

		this.#data = data && typeof data === 'object' ? { ...data } : {};
	}

	/**
	 * Returns one event instance for an arbitrary raw payload or existing wrapper.
	 */
	static from(value) {
		return value instanceof Event ? value : new Event(value);
	}

	/**
	 * Resolves one stored category value into canonical id and label metadata.
	 */
	static readCategoryMeta(value, { fallbackId = 'outro', fallbackLabel = 'Outro' } = {}) {
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
	 * Returns a new event array sorted chronologically.
	 */
	static sortByDate(events) {
		if (!Array.isArray(events)) {
			return [];
		}

		return [...events].sort((left, right) => {
			const leftEvent = Event.from(left);
			const rightEvent = Event.from(right);
			const leftDay = toDayKey(leftEvent.#data?.date);
			const rightDay = toDayKey(rightEvent.#data?.date);

			if (leftDay !== rightDay) {
				return leftDay.localeCompare(rightDay);
			}

			const leftDateOnly = leftEvent.isDateOnly();
			const rightDateOnly = rightEvent.isDateOnly();

			if (leftDateOnly !== rightDateOnly) {
				return leftDateOnly ? -1 : 1;
			}

			return toTimestamp(leftEvent.#data?.date) - toTimestamp(rightEvent.#data?.date);
		});
	}

	/**
	 * Returns a new event array sorted from the latest date to the earliest.
	 */
	static sortByDateDescending(events) {
		return Event.sortByDate(events).reverse();
	}

	/**
	 * Returns a copy of the underlying raw payload.
	 */
	toJSON() {
		return { ...this.#data };
	}

	/**
	 * Returns one event identifier with a safe fallback.
	 */
	readId(fallback = '') {
		return readText(this.#data?.id) || fallback;
	}

	/**
	 * Returns the event title with a safe fallback.
	 */
	readTitle(fallback = 'Sem título') {
		return readText(this.#data?.title) || fallback;
	}

	/**
	 * Returns the event description with a safe fallback.
	 */
	readDescription(fallback = 'Sem descrição.') {
		return readText(this.#data?.description) || fallback;
	}

	/**
	 * Returns the moderation status with a safe fallback.
	 */
	readStatus(fallback = '') {
		return readText(this.#data?.status) || fallback;
	}

	/**
	 * Returns the rejection reason with a safe fallback.
	 */
	readRejectionReason(fallback = '') {
		return readText(this.#data?.rejectionReason) || fallback;
	}

	/**
	 * Returns a normalized author name suitable for public UI copy.
	 */
	readAuthorName(fallback = 'autoria não informada') {
		return readText(this.#data?.organizerName) || fallback;
	}

	/**
	 * Returns the shared event author byline.
	 */
	readAuthorText() {
		return `Por ${this.readAuthorName()}`;
	}

	/**
	 * Returns the canonical category metadata for the current event.
	 */
	readCategoryMeta(options = {}) {
		return Event.readCategoryMeta(this.#data?.categoryLabel || this.#data?.category, options);
	}

	/**
	 * Returns a deduplicated tag summary for the current event.
	 */
	readTagSummary({ visibleCount = 2 } = {}) {
		const sourceTags = Array.isArray(this.#data?.tags) && this.#data.tags.length > 0
			? this.#data.tags
			: [{ id: this.#data?.category, label: this.#data?.categoryLabel }];

		const tags = [];
		const seenLabels = new Set();
		const maxVisibleCount = Math.max(1, visibleCount);

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
			visibleTags: tags.slice(0, maxVisibleCount),
			hiddenTags: tags.slice(maxVisibleCount),
			hiddenCount: Math.max(0, tags.length - maxVisibleCount),
		};
	}

	/**
	 * Reports whether the current event stores only a calendar day without time.
	 */
	isDateOnly() {
		return Boolean(readDateOnlyDay(this.#data?.date));
	}

	/**
	 * Reports whether the current event date is already in the past.
	 */
	isPast(referenceDate = new Date()) {
		const value = this.#data?.date;
		if (!value) {
			return false;
		}

		const dateOnlyDay = readDateOnlyDay(value);
		if (dateOnlyDay) {
			const [yearText, monthText, dayText] = dateOnlyDay.split('-');
			const year = Number(yearText);
			const month = Number(monthText);
			const day = Number(dayText);
			const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
			return Number.isFinite(endOfDay) && endOfDay < referenceDate.getTime();
		}

		const timestamp = toTimestamp(value);
		return Number.isFinite(timestamp) && timestamp < referenceDate.getTime();
	}

	/**
	 * Formats the current event date-time value using the pt-BR locale.
	 */
	formatDateTimePtBr() {
		const normalizedValue = typeof this.#data?.date === 'string' ? this.#data.date.trim() : this.#data?.date;
		const isDateOnly = isDateOnlyValue(normalizedValue) || isDateOnlyIsoValue(normalizedValue);
		const date = isDateOnly
			? createLocalDate(String(normalizedValue).slice(0, 10))
			: new Date(normalizedValue);

		if (Number.isNaN(date.getTime())) {
			return 'Data não informada';
		}

		return new Intl.DateTimeFormat('pt-BR', isDateOnly
			? { dateStyle: 'short' }
			: {
				dateStyle: 'short',
				timeStyle: 'short',
			}).format(date);
	}

	/**
	 * Returns the location text and optional link metadata used by UI renderers.
	 */
	readLocationPresentation(fallback = 'A definir') {
		const text = readText(this.#data?.location) || fallback;
		const href = readLocationHref(text);
		let linkLabel = '';
		let title = text;

		if (href) {
			const url = new URL(href);
			linkLabel = readLocationLinkLabel(url);
			title = href;
		}

		return {
			text,
			href,
			linkLabel,
			isLink: Boolean(href),
			title,
		};
	}

	/**
	 * Creates the DOM node used to render the current event location value.
	 */
	createLocationContent({ fallback = 'A definir', linkClass = '' } = {}) {
		const location = this.readLocationPresentation(fallback);

		if (!location.isLink) {
			return document.createTextNode(location.text);
		}

		const link = document.createElement('a');
		link.href = location.href;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = location.linkLabel || 'Abrir link';
		link.title = location.title;
		link.setAttribute('aria-label', `${link.textContent}: ${location.title}`);

		if (typeof linkClass === 'string' && linkClass.trim()) {
			link.className = linkClass.trim();
		}

		return link;
	}
}