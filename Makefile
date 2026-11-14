.PHONY: dev

# ES・API・UI を起動する。Ctrl+C で止まるのは API と UI だけで、ES は次の起動を待たずに済むよう動かしたままにする
# GNU Make 3.81（macOS 標準）は .ONESHELL がないので、並行起動と後片付けは1つのレシピに行をつないで書く
# /bin/sh（bash 3.2）には wait -n がないので、1秒ごとに両方の生存を確かめ、片方が終わったらもう片方も止めて失敗で終える
dev:
	docker compose up -d --wait
	@test -d ui/node_modules || (cd ui && npm ci)
	@uv run uvicorn book_search.api.app:app --reload & api=$$!; \
	(cd ui && exec npm run dev) & ui=$$!; \
	trap 'kill $$api $$ui 2>/dev/null; wait; exit 130' INT TERM; \
	while kill -0 $$api 2>/dev/null && kill -0 $$ui 2>/dev/null; do sleep 1; done; \
	kill $$api $$ui 2>/dev/null; wait; exit 1
