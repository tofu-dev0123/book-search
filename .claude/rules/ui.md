---
paths:
  - "ui/**"
---

# UI を編集するとき

ルールの本文は `docs/coding-rules-ui.md` にある。ここには書き写さない（2か所に書くと、ずれたときにどちらが正しいか分からなくなる）。

- セッションで最初に UI のファイル（`ui/src/` の `.ts`・`.tsx`・`.css`）を編集しようとすると、フックがその編集を止めて `docs/coding-rules-ui.md` の本文を返す。ルールに沿って編集をやり直す
- Prettier と `eslint --fix` は、UI のファイルを編集するたびにフックが流す（`.css` は Prettier だけ）。自分で流す必要はない。フックが違反を返したら直す
- Bash（`sed -i`・ヒアドキュメントなど）で UI のファイルを書き換えた場合も、フックが書き換えの後に Prettier と ESLint を流す。セッションで最初の書き換えなら `docs/coding-rules-ui.md` の本文も返すので、書き換えがルールに沿っているか見直す
- 型チェックはフックで流れない。コミットの前に `ui/` で `npm run typecheck` と `npm test` を流し、通ることを確かめる。`ui/` 直下の設定ファイルを変えたときは `npm run format:check` と `npm run lint` も流す
