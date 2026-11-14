# 開発環境

ローカルで Elasticsearch を起動し、検索が返るところまでを確認する手順。

## 前提

- Docker と Docker Compose
- Docker に割り当てるメモリは 4GB 以上（ES のヒープを 1GB に固定している。ヒープ以外にもメモリを使う）
  - Colima の場合: `colima start --memory 4`
- 検索 UI を動かす場合は Node.js（版は `ui/.node-version`）と npm

## まとめて起動する

リポジトリ直下で実行する。

```bash
make dev
```

- Elasticsearch を起動して healthy になるまで待ち、検索 API（`localhost:8000`）と検索 UI（`localhost:3000`）を並行して起動する。個別の起動手順は下の「起動」「検索 API」「検索 UI」
- 前提: `books` に書誌を投入済み（下の「書誌の投入」）。投入は `make dev` に含まない
- `ui/node_modules` がなければ、先に `npm ci` を流す。依存を変えたとき（`ui/package-lock.json` が変わったとき）は流さないので、手で `cd ui && npm ci` を流す
- Ctrl+C で API と UI が止まる。Elasticsearch は動いたままで、次の `make dev` では起動を待たない。止めるときは「停止」の `docker compose down`
- API と UI の片方が終了すると（3000 番が埋まっているときの UI など）、もう片方も止めて `make dev` は失敗で終わる

## 起動

```bash
docker compose up -d
docker compose ps   # STATUS が (healthy) になるまで待つ（数十秒）
```

- `127.0.0.1:9200` でのみ待ち受ける。開発用に認証と TLS を切っているため、外部には公開しない
- データは名前付きボリューム `es-data` に保存される。`docker compose down` では消えず、`docker compose down -v` で消える

## 疎通確認

zsh では URL の `?` がグロブとして解釈されるので、URL はクォートで囲む。

### クラスタの状態

```bash
curl -s 'localhost:9200/_cluster/health?pretty'
```

`"status" : "green"` が返る。

### サンプルを1件 index する

```bash
curl -s -X POST 'localhost:9200/smoke-test/_doc?refresh=true' \
  -H 'Content-Type: application/json' \
  -d '{"title": "機械学習入門", "description": "初学者向けに機械学習の基礎を解説する"}'
```

`"result":"created"` が返る。index は自動で作られ、マッピングは動的に決まる。

この時点でクラスタの状態は `yellow` になる。単一ノードではレプリカを置く先が無いためで、異常ではない。

### 検索する

```bash
curl -s 'localhost:9200/smoke-test/_search?pretty' \
  -H 'Content-Type: application/json' \
  -d '{"query": {"match": {"title": "機械学習"}}}'
```

`hits.total.value` が `1` で、`_source` に index した文書が返る。

### 後片付け

```bash
curl -s -X DELETE 'localhost:9200/smoke-test'
```

## 書誌の投入

openBD から内容紹介つきの書誌を取得し、index `books` に投入する。取得（`fetch`）と投入（`load`）は別のコマンドで、index の設定を変えたときは `load` だけをやり直せばよい。

### 前提

- [uv](https://docs.astral.sh/uv/)（`brew install uv` または公式のインストーラ）。Python 3.13 は uv が `.python-version` を見て自動で入れる
- Elasticsearch が起動している（上の「起動」）

### 取得する

```bash
uv run fetch
```

- openBD から内容紹介（TextType 03、なければ 02）が 50 文字以上ある書誌を 1,000 件取り、`data/books.jsonl` に保存する。数十秒かかる
- 書誌は `sha256(シード + ISBN)` の小さい順に取る。シードが同じなら、openBD の収録件数が多少増減しても、ほぼ同じ書誌の集合になる
- レコードは openBD の JSON を加工せずに1行1件で保存する
- `data/` は git の管理外。openBD のデータはリポジトリに含めない（[ADR-002](adr/002-data-source.md)）
- オプション: `--seed`（既定: 0）、`--limit`（既定: 1000）、`--out`（既定: `data/books.jsonl`）

### 投入する

```bash
uv run load
```

`books に 1000 件を投入した` が出る。

- 毎回 index `books` を削除して作り直してから投入する。index の定義は `src/book_search/ingest/books_index.json`
- `_id` は ISBN。再実行しても件数は増えない
- 接続先は環境変数 `ES_URL` で変えられる（既定: `http://localhost:9200`）
- オプション: `--input`（既定: `data/books.jsonl`）、`--index`（既定: `books`）

### 検索する

```bash
curl -s 'localhost:9200/books/_search?pretty' \
  -H 'Content-Type: application/json' \
  -d '{"query": {"match": {"description": "歴史"}}, "_source": ["isbn", "title"]}'
```

`hits.total.value` が 1 以上で、内容紹介に「歴史」を含む書誌が返る。1,000 件は人文・社会科学の学術書に寄るため、技術書のクエリ（`機械学習` など）はヒットしないことがある。

## 検索 API

### 起動

```bash
uv run uvicorn book_search.api.app:app --reload
```

- `localhost:8000` で待ち受ける。`--reload` はコードの変更を検知して再起動する
- 前提: Elasticsearch が起動していて、`books` に書誌を投入済み（上の「書誌の投入」）
- 環境変数:
  - `ES_URL`: Elasticsearch の接続先（既定: `http://localhost:9200`）
  - `CORS_ORIGINS`: UI のオリジン。カンマ区切りで複数指定できる（既定: `http://localhost:3000`）

### 確認

```bash
curl -s 'localhost:8000/healthz'
```

`{"status":"ok"}` が返る。Elasticsearch に繋がらないとき、または `books` がないときは 503。

```bash
curl -s -G 'localhost:8000/search' --data-urlencode 'q=歴史' -d size=3 | python3 -m json.tool
```

`total`・`took_ms`・`hits`（各書誌と `score`）が返る。

URL に日本語をそのまま書くと（`'localhost:8000/search?q=歴史'`）、uvicorn は `Invalid HTTP request` として 400 を返す。`--data-urlencode` でエンコードして渡す。

- パラメータ: `q`（必須。空や空白だけは 422）、`size`（1〜100、既定 20）、`from`（0 以上、既定 0。`from + size` は 10000 以下）
- 範囲外の値は 422。Elasticsearch に繋がらないとき、または `books` がないときは 503
- API の仕様は `localhost:8000/docs` でも見られる

### Python から検索する

検索ロジックは API に依存しない関数で、評価スクリプトなどから直接呼べる。

```python
from elasticsearch import Elasticsearch
from book_search.search import query

query.search(Elasticsearch("http://localhost:9200"), "歴史", size=3, from_=0)
```

## 検索 UI

### 起動

```bash
cd ui
npm ci
npm run dev
```

- `localhost:3000` で待ち受ける。3000 番が埋まっているときは、別のポートに移らずにエラーで止まる（検索 API の CORS の既定が `http://localhost:3000` のため）
- 前提: 検索 API が起動している（上の「検索 API」）
- 環境変数:
  - `VITE_API_URL`: 検索 API の接続先（既定: `http://localhost:8000`）。`VITE_API_URL=http://localhost:8001 npm run dev` のように渡す

### 確認

ブラウザで `localhost:3000` を開き、「探しているのは、」に続く空欄に `歴史` と入れて送ると、`/search?q=歴史` に移って検索結果が並ぶ。

### アイコンと OGP 画像の書き出し

アイコンや名前（`BRAND_NAME`）、OGP 画像の文言を変えたときは、`ui/` で次を流し、書き出したファイルをコミットする。

```bash
npm run brand:build
```

- 元のファイルは `ui/brand/` にある: アイコンの SVG（`icon.svg`）・OGP 画像の HTML の型（`og-image.html`）・書き出しのスクリプト（`build.ts`）
- `ui/public/` に `favicon.svg`・`favicon-32.png`・`apple-touch-icon.png`（180px）・`og-image.png`（1200×630）を書き出す
- PNG は手元の Chrome のヘッドレスモードで描画する。OGP 画像は Google Fonts を読むので、ネットワークに繋がっている必要がある
- 環境変数:
  - `CHROME_PATH`: Chrome の実行ファイル（既定: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）
- `npm run build` には含まない。ビルドのたびに作り直さず、書き出したファイルをそのまま使う

### 整形・lint・テスト・ビルド

Prettier・ESLint・型チェック・Vitest・ビルドの実行方法と、テストの置き場所と方針は [実装ルール（UI）](coding-rules-ui.md) にある。

## 整形・lint・テスト

ruff（整形・lint）と pytest の実行方法、テストの置き場所と方針は [実装ルール](coding-rules.md) にある。

## 停止

```bash
docker compose down      # データは残る
docker compose down -v   # データも消す
```
