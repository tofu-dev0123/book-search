# book-search

書籍検索 API と検索フォーム UI。索引語検索のベースラインから、ベクトル検索・ハイブリッド検索・生成検索へ段階的に進める。

## 段階構成

| 段階 | 内容 |
|---|---|
| 1 | 索引語検索のベースライン（ES + 検索API + 最小UI + nDCG の測定） |
| 2 | ベクトル検索 → ハイブリッド（dense_vector / kNN + RRF） |
| 3 | 生成検索（RAG） |
| 4 | 一般公開（時期未定） |

- 各段階の成果物は「動いたこと」ではなく、**前段階からの nDCG の改善幅**。検索の挙動を変える変更は、評価セットで nDCG を測って前後を比較する
- 改善の主張には測定結果を添える。測っていない改善を「良くなった」と書かない

## 決定済みの技術

| 項目 | 決定 | 根拠 |
|---|---|---|
| データ | openBD（内容紹介つき 約10万件） | |
| 検索エンジン | Elasticsearch 9.5 | |
| 日本語の分割 | bigram | |
| API・検索・投入・評価 | Python / FastAPI | [ADR-001](docs/adr/001-language.md) |
| UI | TypeScript | [ADR-001](docs/adr/001-language.md) |

- ES は無料版（Basic）を前提にする。`text_embedding` などの推論機能は使えないので、埋め込みはアプリ側（Python）で作る
- 決定済みの項目を覆す変更は、実装の前に ADR を追加する

## ADR

- 置き場所: `docs/adr/NNN-<slug>.md`（連番は3桁）
- 選んだ案だけでなく、**選ばなかった選択肢とトレードオフ**を書く
- 見直し条件を書く

## 公開リポジトリとしての方針

このリポジトリは公開する。コミットメッセージ・PR・Issue・ドキュメントに書くのは**技術的な判断と根拠だけ**にする。個人的な事情や意向は書かない（それらは `CLAUDE.local.md` にあり、公開しない）。

## 起動と検証

- 起動: `make dev`（Elasticsearch・検索 API `localhost:8000`・検索 UI `localhost:3000`）。前提と書誌の投入は [docs/dev-setup.md](docs/dev-setup.md)
- 検証: `./scripts/check`（ruff・pytest・UI の lint・型・テスト・ビルド）。ES が要るテストは含まないので、ES に関わる変更では `uv run pytest -m es` も流す
- 整形: `./scripts/format <ファイル>`。編集したファイルにはフックが流す

## 設計書

| 場所 | 中身 |
|---|---|
| Issue | 個々の変更の設計（Issue を設計書として扱う） |
| `docs/adr/` | 技術の決定とその根拠（上の「ADR」） |
| `docs/evaluation.md`・`eval/` | 評価セットの設計とクエリ |
| `docs/coding-rules.md`・`docs/coding-rules-ui.md` | 実装ルール |
| `docs/dev-setup.md` | 起動・投入・確認の手順 |

## 開発フロー

起票から PR までは conventions の issue-driven の流れ（`.claude/rules/shared/issue-driven.md`）に従う。book-search で足すこと・マージの方針は [docs/development-flow.md](docs/development-flow.md) にある。

- 起票は `/feature`・`/bugfix`、Issue の実装から PR の作成までは `/implement <Issue番号>` を使う。グローバルの `issue` / `issues` / `pr` / `commit` スキルは使わない（フローが異なる）
- 検索の挙動を変える Issue には「評価」の節を足す（検索結果を変える／変えない、測定方法、採用の基準）。PR には、評価セットでの main との nDCG の比較を載せる
- コードの配置・依存の向き・命名・テストの方針・禁止事項は、Python は [docs/coding-rules.md](docs/coding-rules.md)、UI（`ui/`）は [docs/coding-rules-ui.md](docs/coding-rules-ui.md) に従う。Claude には、セッションで最初にその言語のファイル（`.py`、または `ui/src/` の `.ts`・`.tsx`・`.css`）を編集するときにフックが本文を渡す（Bash で書き換えた場合は、書き換えの後に見直しの指示と一緒に渡す）
