/**
 * Returns a safe user-facing text fallback for one location value.
 */
function readText(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalizedValue = value.trim();
	return normalizedValue || fallback;
}

/**
 * Normalizes a location string into a valid HTTP(S) URL when possible.
 */
export function readLocationHref(value) {
	const normalizedValue = readText(value, '');
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
		const hostname = readText(url?.hostname, '').replace(/^www\./i, '');
		return hostname || 'link externo';
}

/**
	* Returns the best user-facing label for one external location link.
	*/
function readLocationLinkLabel(url) {
		const hostname = readHostnameLabel(url);
		const normalizedHostname = hostname.toLowerCase();
		const normalizedPathname = readText(url?.pathname, '/').toLowerCase();

		if (
			normalizedHostname.includes('maps.google')
			|| normalizedHostname.includes('waze')
			|| normalizedHostname.includes('openstreetmap')
			|| normalizedHostname.includes('apple.com')
			|| normalizedPathname.startsWith('/maps')
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
 * Returns the location text and optional link metadata used by card renderers.
 */
export function readLocationPresentation(value, fallback = 'A definir') {
	const text = readText(value, fallback);
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
 * Creates the DOM node used to render one event location value.
 */
export function createLocationContent(value, { fallback = 'A definir', linkClass = '' } = {}) {
	const location = readLocationPresentation(value, fallback);

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