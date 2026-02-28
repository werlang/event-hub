preflight:
	@echo "[preflight] running sct"
	just sct

sct:
	@echo "[sct] running repository checks"
	make checks