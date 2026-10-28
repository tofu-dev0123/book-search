# book-search

日本語書籍の検索 API と検索 UI。openBD の書誌データ（内容紹介つき 約10万件）を Elasticsearch に投入し、キーワード検索・ベクトル検索・生成検索を段階的に実装する。
各手法の検索品質を nDCG で測定し、段階ごとの改善幅を比較できるようにする。

## 技術構成

| 項目 | 採用 |
|---|---|
| データソース | openBD |
| 検索エンジン | Elasticsearch 9.5（Basic ライセンス） |
| 日本語の分割 | bigram |
| API・検索・投入・評価 | Python / FastAPI |
| UI | TypeScript |

## ロードマップ

各段階の成果物は、前段階からの nDCG の改善幅とする。

| 段階 | 内容 | |
|---|---|---|
| 1 | キーワード検索のベースライン（ES + 検索 API + 最小 UI + nDCG の測定） | ← 現在地 |
| 2 | ベクトル検索 → ハイブリッド検索（dense_vector / kNN + RRF） | |
| 3 | 生成検索（RAG） | |

## セットアップ

前提: Docker と Docker Compose（Docker に割り当てるメモリは 4GB 以上）

```bash
docker compose up -d
docker compose ps   # STATUS が (healthy) になるまで待つ
curl -s 'localhost:9200/_cluster/health?pretty'
```

Elasticsearch が `127.0.0.1:9200` で起動する。疎通確認と停止の手順は [docs/dev-setup.md](docs/dev-setup.md) を参照。

## 設計上の判断

判断の根拠と、選ばなかった選択肢を ADR に残している。

| ADR | 決定 |
|---|---|
| [001](docs/adr/001-language.md) | 実装言語に Python / FastAPI を採用する（UI は TypeScript） |

データソース・検索エンジン・日本語の分割方式の ADR は [#8](https://github.com/tofu-dev0123/book-search/issues/8) で追加する。
