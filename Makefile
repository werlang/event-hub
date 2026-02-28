SHELL := /bin/sh

.PHONY: checks
checks:
	@echo "[checks] validating API JavaScript syntax inside container"
	@docker compose -f compose.dev.yaml exec -T api node --check app.js
	@docker compose -f compose.dev.yaml exec -T api node --check routes/auth.js
	@docker compose -f compose.dev.yaml exec -T api node --check routes/events.js
	@docker compose -f compose.dev.yaml exec -T api node --check middleware/auth.js
	@docker compose -f compose.dev.yaml exec -T api node --check middleware/error.js
	@docker compose -f compose.dev.yaml exec -T api node --check helpers/error.js
	@docker compose -f compose.dev.yaml exec -T api node --check helpers/response.js
	@echo "[checks] validating Web JavaScript syntax inside container"
	@docker compose -f compose.dev.yaml exec -T web node --check app.js
	@docker compose -f compose.dev.yaml exec -T web node --check src/js/index.js
	@docker compose -f compose.dev.yaml exec -T web node --check src/js/login.js
	@docker compose -f compose.dev.yaml exec -T web node --check src/js/publish.js
	@echo "[checks] all checks passed"
