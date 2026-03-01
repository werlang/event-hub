export function setFormEnabled(form, enabled) {
	if (!form) {
		return;
	}

	form.classList.toggle('form--disabled', !enabled);
	form.querySelectorAll('input, select, textarea, button').forEach(field => {
		field.disabled = !enabled;
	});
}
