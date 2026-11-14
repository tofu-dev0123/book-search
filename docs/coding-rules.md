# 実装ルール

Python のコードを書くときのルール。人・Claude Code・レビュー（[reviewer](../.claude/agents/reviewer.md) の G1）が同じこの文書を基準にする。

ルールの性質ごとに、守らせる手段を分けている。

| ルール | 手段 |
|---|---|
| 本文を Claude に届ける | Claude Code のフック（`.claude/hooks/coding-rules.sh`）。セッションで最初の `.py` の編集を止めて、この文書を返す。Bash で書き換えた場合は、書き換えの後に見直しの指示と一緒に返す（`.claude/hooks/bash-py.sh`） |
| format・lint | Claude Code のフック（`.claude/hooks/ruff.sh`）。Bash で書き換えた `.py` にも流す（`.claude/hooks/bash-py.sh`） |
| 依存の向き | `tests/test_dependencies.py` |
| 実行の漏れ | `/implement` の完了条件の検証で ruff と pytest を必ず流す |
| それ以外（責務の置き場所・テストの方針・禁止事項・コメント） | レビュー（この文書に沿っているか） |

## 配置

### リポジトリ直下

| 場所 | 中身 |
|---|---|
| `pyproject.toml`・`src/book_search/` | Python（API・検索・投入・評価） |
| `tests/` | Python のテスト |
| `ui/` | UI（TypeScript）。Python とはコードを共有せず、HTTP だけで繋ぐ（[ADR-001](adr/001-language.md)） |
| `eval/` | 評価セット（クエリと ISBN・関連度）。git で管理して nDCG の比較を再現できるようにする |

### サブパッケージと依存の向き

`src/book_search/` は責務ごとのサブパッケージに分ける。

| サブパッケージ | 責務 | 依存してよい先（パッケージ内） |
|---|---|---|
| `api` | HTTP の入出力 | `search` |
| `evaluation` | 評価セットでの nDCG の測定 | `search` |
| `search` | クエリの組み立てと実行 | なし |
| `ingest` | openBD からの取得と ES への投入 | なし |

- 検索の挙動（クエリの組み立てと実行）は `search` に集める。`api` と `evaluation` は `search` を呼ぶだけにする。評価で測る検索と API が返す検索を同じコードにするため
- 依存の向きは `tests/test_dependencies.py` が検査する。相対 import は依存先を名前で判定できないので使わない
- 新しいサブパッケージを足すときは、この表と `tests/test_dependencies.py` の `ALLOWED` に依存してよい先を足す

### パッケージとモジュール

- `__init__.py` は空にし、再エクスポートしない。import はモジュールまで書く（`from book_search.search import query`）。定義の場所を import から追えるようにするため
- モジュールが読むデータファイルは、読むモジュールと同じサブパッケージに置き、`importlib.resources` で読む（`ingest/books_index.json`）
- CLI は `pyproject.toml` の `[project.scripts]` に登録し、`uv run <名前>` で実行する（`uv run fetch`・`uv run load`）

## モジュールの書き方

- モジュールの先頭に docstring を置き、責務を1〜2行で書く。前提や方針があれば続けて書く
- コメントは日本語で、コードを読めば分かる「何を」ではなく「なぜ」を書く（ES の制約・採った値の根拠・あとで測ってから変えるもの など）
- 環境で変わる値（接続先・オリジンなど）は環境変数で受け、ローカルの開発で動く既定値を持つ（`ES_URL` の既定は `http://localhost:9200`）。環境変数を足したら `docs/dev-setup.md` に書く
- 検索の挙動を変える値（検索対象のフィールド・重み・クエリの型など）は、評価セットで nDCG を測ってから変える

## テスト

### 置き場所と実行

- `tests/` に、`src/book_search/` のサブパッケージと同じ構成で置く（`tests/search/test_query.py` など）
- `uv run pytest` は ES なしで通るテストだけを流す。ES を起動しないとテストが一切通らなくなるのを避けるため
- ES が要るテストには `@pytest.mark.es` を付け、compose の ES に対して `uv run pytest -m es` で流す
- ES を使うテストは `books` ではなく専用の index（`test-books`）を使い、終わったら消す。`load` は index を削除して作り直すので、開発用のデータを消さないため

### 層ごとに確かめること

| 層 | 確かめること | ES |
|---|---|---|
| `search` | クエリの組み立てと、実物の ES に投入した書誌での検索結果 | 実物（`-m es`） |
| `api` | HTTP の分岐（422・503 など）。`search` の関数を差し替える | 使わない |
| `ingest` | openBD のレコードから投入する文書への変換 | 使わない |

### ES をモックしない

ES のクライアントを丸ごとモックして応答を作り込むテストは書かない。ES の応答の形を自前で再現すると、実物とずれても気づけないため。ES の挙動に依存するところは `-m es` のテストで確かめる。

## 禁止事項

- `search` の外でクエリを組み立てない。評価と API が別々のクエリを測る・返すことになる
- API の応答に ES の例外の内容を出さない。例外には ES のホストやポートが含まれる。内容はログに残し、応答は 503 などの固定の文言にする
- openBD から取得したデータをリポジトリに入れない。テストの書誌は合成したものを使う（[ADR-002](adr/002-data-source.md)）
- 秘密情報（パスワード・トークンなど）をコードやドキュメントに書かない。接続先などは環境変数で受ける
- ES のクライアントをモックしたテストを書かない（上の「ES をモックしない」）

## lint と format

```bash
uv run ruff format          # 整形する（確認だけなら --check）
uv run ruff check           # lint（自動で直せるものは --fix）
```

- 設定は `pyproject.toml` の `[tool.ruff]`（`line-length = 120`、`select = ["E", "F", "I", "UP", "B"]`）
- Claude Code が `.py` を編集すると、フックが `ruff format` と `ruff check --fix` を流す。自動で直せない違反は Claude に返る。Bash で書き換えた場合も、書き換えの後に流す
- ルールを足すときは、必要になったものを個別に `select` に足す（`ALL` は使わない）
