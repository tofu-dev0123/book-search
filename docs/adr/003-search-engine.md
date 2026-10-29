# ADR-003: 検索エンジンに Elasticsearch 9.5 を使う

- ステータス: 採用
- 日付: 2026-10-29
- 関連: #8

## 背景

段階1 の索引語検索から、段階2 のベクトル検索・ハイブリッド検索、段階3 の生成検索まで、同じ検索エンジンで進める。検索エンジンに求める要件は次のとおり。

| # | 要件 | 理由 |
|---|---|---|
| 1 | BM25 による全文検索と、日本語向けの分割を設定できる | 段階1 のベースライン |
| 2 | ベクトル検索（kNN）ができる | 段階2 |
| 3 | 全文検索とベクトル検索の結果を融合できる | 段階2 のハイブリッド検索 |
| 4 | 無料で使える | 個人開発で、有償ライセンスを前提にしない |
| 5 | Python の公式クライアントがある | [ADR-001](001-language.md) |

### Basic ライセンスで使える範囲（2026-10-29 にローカルの 9.5.5 で確認）

| 機能 | Basic で使えるか | 確認方法 |
|---|---|---|
| `dense_vector` と kNN 検索 | 使える | `knn` を指定した検索が結果を返した |
| `rrf` retriever | **使えない** | `current license is non-compliant for [Reciprocal Rank Fusion (RRF)]` |
| `linear` retriever | **使えない** | `current license is non-compliant for [linear retriever]` |
| 埋め込みの生成（`text_embedding` 推論、学習済みモデルのデプロイ） | 使えない | [ADR-001](001-language.md) の制約① |
| `ngram` tokenizer / `cjk_bigram` filter | 使える | 標準で組み込まれている |
| `kuromoji_tokenizer` | 追加で導入が必要 | `analysis-kuromoji` プラグインの導入が必要（未導入では `failed to find global tokenizer`） |

## 決定

**検索エンジンに Elasticsearch 9.5 を Basic ライセンスで使う。埋め込みの生成と、ハイブリッド検索の結果の融合（RRF）はアプリ側（Python）で行う。**

```
Python(API) ── _msearch [BM25 検索, kNN 検索] ──> ES ──> 2 つの順位リスト ──> Python で RRF ──> 結果
```

BM25 検索と kNN 検索は `_msearch` で 1 回のリクエストにまとめ、ES 側で並列に実行させる。ES の `rrf` retriever も内部では 2 つの検索を実行してから融合するため、ES 側の処理量は変わらない。増えるのは、候補リストの転送と Python 側での RRF の計算だけである。

### 決め手

1. **段階1〜2 に必要な検索機能が Basic で揃う。** BM25・日本語の分割・kNN が無料で使える（要件1・2・4）
2. **RRF をアプリ側で持つことは、nDCG の改善を回すうえで不利にならない。** RRF は順位から計算するだけの処理で、実装は数十行で済む。融合の重み・定数 k・候補数を Python 側で変えて、評価セットの nDCG を直接比べられる
3. **情報量が多い。** 公式ドキュメント・事例・日本語の資料が多く、詰まったときに調べやすい
4. **公式の Python クライアントがある**（要件5）

## 検討した選択肢

### OpenSearch

- 長所:
  - Apache 2.0 で、ライセンスによる機能制限がない
  - ハイブリッド検索の融合を検索パイプラインで提供している。RRF（`score-ranker-processor`）は 2.19 から使える（[OpenSearch docs](https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/rrf/)）
  - ML Commons / neural search で、エンジン内で埋め込みを生成できる
- 不採用の理由:
  - 主な長所の二つ（RRF と埋め込みの生成）は、どちらもアプリ側で持つ方針と重なる。埋め込みの生成は [ADR-001](001-language.md) で Python 側に置くと決めており、エンジン側に置く利点が小さい
  - Elasticsearch と比べて、資料や事例が少ない
- 機能面では最も近い代替で、差は小さい。見直し条件を参照

### Apache Solr

- 長所: Apache 2.0。kuromoji を標準で同梱している。dense vector による kNN 検索がある。
- 不採用の理由: ハイブリッド検索まわりの機能と資料が Elasticsearch / OpenSearch より少ない。設定が XML 中心で、試行錯誤のたびに手間がかかる。

### Vespa

- 長所: 全文検索・ベクトル検索・ランキング式を一つのエンジンで柔軟に組める。
- 不採用の理由: 設定とランキングの概念が独自で、学習コストが高い。段階1 のベースラインを早く作ることを優先する。

### Meilisearch / Typesense

- 長所: 導入が簡単で、ハイブリッド検索の機能を持つ。
- 不採用の理由: スコアリングや分割方式の細かい調整が難しく、nDCG を見ながら改善を回す用途に合わない。

### PostgreSQL（全文検索 + pgvector）

- 長所: 一つのデータベースで済む。
- 不採用の理由: 標準の全文検索は日本語の分割に対応しておらず、拡張（pg_bigm / PGroonga など）が必要になる。BM25 によるスコアリングを標準では持たない。

## 結果

- 段階2 のハイブリッド検索は、BM25 検索と kNN 検索を `_msearch` でまとめて投げ、Python 側で RRF を計算する。README と ADR-001 の段階2 にある「kNN + RRF」は、この構成を指す
- 融合のパラメータ（定数 k・重み・各検索の候補数）は Python 側で管理し、評価スクリプトから変えて比較する
- kuromoji を使う場合は、`analysis-kuromoji` を導入したイメージを用意する必要がある（[ADR-004](004-japanese-tokenization.md)）

## 見直し条件

- 段階2 でレイテンシを測り、Python 側での融合（候補リストの転送と RRF の計算）が無視できない割合を占めると分かった場合
- アプリ側の RRF では足りない融合の方式（学習による重みづけなど）を試す必要が出て、その機能が OpenSearch では無料で使える場合
- Elastic のライセンス体系が変わり、Basic で使える範囲が広がる、または狭まる場合
- 段階4（一般公開）で、運用コストや性能の要件からマネージドサービスを選ぶ場合
