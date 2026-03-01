const INVITE_KEYS = ['inviteToken', 'invite', 'token'];
const INVITE_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

function findToken(queryParams) {
	for (const key of INVITE_KEYS) {
		const candidate = queryParams.get(key);
		if (candidate) {
			return candidate.trim();
		}
	}

	return '';
}

export function readInviteTokenFromUrl(search = window.location.search) {
	const queryParams = new URLSearchParams(search);
	const token = findToken(queryParams);

	if (!token) {
		return {
			status: 'missing',
			token: '',
			message: 'Registro bloqueado: acesse com um link de convite válido.',
		};
	}

	if (!INVITE_PATTERN.test(token)) {
		return {
			status: 'invalid',
			token: '',
			message: 'Convite inválido: solicite um novo link ao administrador.',
		};
	}

	return {
		status: 'ready',
		token,
		message: 'Convite detectado. Você já pode criar sua conta.',
	};
}
