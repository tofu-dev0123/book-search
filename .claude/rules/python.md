---
paths:
  - "src/**/*.py"
  - "tests/**/*.py"
---

# Python を編集するとき

ルールの本文は `docs/coding-rules.md` にある。ここには書き写さない（2か所に書くと、ずれたときにどちらが正しいか分からなくなる）。

- セッションで最初に `.py` を編集しようとすると、フックがその編集を止めて `docs/coding-rules.md` の本文を返す。ルールに沿って編集をやり直す
- ruff の format と `check --fix` は、`.py` を編集するたびにフックが流す。自分で流す必要はない。フックが違反を返したら直す
- コミットの前に `uv run pytest` を流し、通ることを確かめる。ES に関わる変更なら `uv run pytest -m es` も流す
