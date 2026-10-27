# 開発環境

ローカルで Elasticsearch を起動し、検索が返るところまでを確認する手順。

## 前提

- Docker と Docker Compose
- Docker に割り当てるメモリは 4GB 以上（ES のヒープを 1GB に固定している。ヒープ以外にもメモリを使う）
  - Colima の場合: `colima start --memory 4`

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

## 停止

```bash
docker compose down      # データは残る
docker compose down -v   # データも消す
```
