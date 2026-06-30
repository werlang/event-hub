/**
 * Creates text and anchor nodes from pre-normalized text/link segments.
 */
export function createLinkedTextContent(segments, { linkClass = '' } = {}) {
    const fragment = document.createDocumentFragment();
    const normalizedLinkClass = typeof linkClass === 'string' ? linkClass.trim() : '';

    if (!Array.isArray(segments)) {
        return fragment;
    }

    segments.forEach((segment) => {
        if (!segment || typeof segment !== 'object') {
            return;
        }

        const text = typeof segment.text === 'string' ? segment.text : '';
        if (!text) {
            return;
        }

        if (segment.type !== 'link' || typeof segment.href !== 'string' || !segment.href) {
            fragment.appendChild(document.createTextNode(text));
            return;
        }

        const link = document.createElement('a');
        link.href = segment.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = text;
        link.title = segment.href;
        link.setAttribute('aria-label', `Abrir link externo: ${segment.href}`);

        if (normalizedLinkClass) {
            link.className = normalizedLinkClass;
        }

        fragment.appendChild(link);
    });

    return fragment;
}
