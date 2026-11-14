# 実装ルール（UI）

UI（`ui/`、TypeScript）のコードを書くときのルール。人・Claude Code・レビュー（[reviewer](../.claude/agents/reviewer.md) の G1）が同じこの文書を基準にする。Python のルールは [coding-rules.md](coding-rules.md) にある。

## 守らせる手段

ルールの性質ごとに、守らせる手段を分けている。

| ルール | 手段 |
|---|---|
| 本文を Claude に届ける | Claude Code のフック（`.claude/hooks/coding-rules.sh`）。セッションで最初の UI のファイル（`ui/src/` の `.ts`・`.tsx`・`.css`）の編集を止めて、この文書を返す。Bash で書き換えた場合は、書き換えの後に見直しの指示と一緒に返す（`.claude/hooks/bash-edit.sh`） |
| format・lint | Claude Code のフック（`.claude/hooks/prettier-eslint.sh`）。編集した UI のファイルに Prettier と ESLint を流す。Bash で書き換えた UI のファイルにも流す（`.claude/hooks/bash-edit.sh`） |
| 依存の向き | ESLint の `no-restricted-imports`（`ui/eslint.config.js`） |
| 実行の漏れ | `/implement` の完了条件の検証で、`ui/` を変えたときは下の「コマンド」をすべて流す |
| それ以外（責務の置き場所・命名・スタイル・テストの方針・禁止事項・コメント） | レビュー（この文書に沿っているか） |

## 配置と依存の向き

`ui/src/` は責務ごとのディレクトリに分ける。

| 場所 | 責務 | 依存してよい先（`src/` 内） |
|---|---|---|
| `main.tsx` | 起動。グローバルの CSS とルーターを読み込み、`App` を描く | `App.tsx`・`styles/` |
| `App.tsx` | ルーティング（URL と画面の対応） | `pages/` |
| `pages/` | 画面（URL 1つに1つ）。URL のパラメータを読み、API を呼び、コンポーネントを並べる | `components/`・`lib/` |
| `components/` | 画面の部品 | `lib/` |
| `lib/` | React に依存しない関数と定数（API の呼び出し・表示の整形・ページの計算・設定） | なし（`lib/` の中どうしは可） |
| `styles/` | 全体の CSS（`global.css`）。色・フォントの変数を定義する | — |

- `lib/` から React（`react`・`react-dom`・`react-router`）・`components/`・`pages/`・CSS を import しない。画面を描かずにテストできるようにするため
- `components/` から `pages/` を import しない
- 依存の向きは ESLint の `no-restricted-imports` が検査する
- CSS Modules はコンポーネントの隣に、同じ名前で置く（`BookList.tsx` と `BookList.module.css`）

## モジュールの書き方

- コメントは日本語で、コードを読めば分かる「何を」ではなく「なぜ」を書く（API・ES の制約・採った値の根拠・表示の意図 など）
- 環境で変わる値（接続先など）は `VITE_` の環境変数で受け、ローカルの開発で動く既定値を持つ（`VITE_API_URL` の既定は `http://localhost:8000`。`lib/config.ts`）。環境変数を足したら `docs/dev-setup.md` に書く
- export は名前付きにする（`export function BookList`）。default export は使わない
- import は、外部のパッケージ・`src/` 内のモジュール・CSS Modules の順に並べ、外部と `src/` 内の間を1行空ける
- 型は `type` で書く。`interface` は、既存の型を拡張する宣言（`vite-env.d.ts` の `ImportMetaEnv`）にだけ使う

## 命名

現行コードの書き方を規則にしたもの。ここにない場面は、必要になったときに足す。

| 対象 | 規則 | 例 |
|---|---|---|
| コンポーネントとそのファイル | パスカルケース。ファイル名はコンポーネント名と同じ | `BookList`（`BookList.tsx`）・`Search`（`pages/Search.tsx`） |
| props の型 | `Props`。少ないときはインラインで書く | `type Props = { ... }`・`{ hits }: { hits: Hit[] }` |
| `lib/` のファイル | 責務を表す短い小文字の名詞 | `api.ts`・`format.ts`・`paging.ts`・`config.ts` |
| 関数（処理） | 動詞から始める。変換は `to<変換先>` | `search`・`formatPubdate`・`parsePage`・`toFrom` |
| 関数（真偽値） | `has`・`is` から始める | `hasNextPage` |
| イベントの props と、渡す関数 | props は `on<動作>`。渡す関数は動詞（`handle` を付けない） | `onMove={move}`・`onSubmit={submit}` |
| 定数 | 大文字のスネークケース。単位を名前に入れる。ES・API の用語に合わせる | `LOADING_DELAY_MS`・`PAGE_SIZE`・`MAX_RESULT_WINDOW` |
| CSS Modules のクラス名 | 役割を表す小文字の英単語1語 | `.list`・`.item`・`.cover`・`.dimmed` |
| テスト | `describe` に対象の関数名、`test` に条件と結果を日本語で書く | `describe('parsePage')`・`test('最後のページでは次へ進めない')` |

## スタイル

- CSS は CSS Modules で書く。全体に効かせるもの（変数・`body` など）だけを `styles/global.css` に書く
- 色・フォントは `styles/global.css` の変数（`--fg`・`--muted`・`--accent`・`--sans` など）を使い、コンポーネントの CSS に値を直接書かない
- ダークモードは、`global.css` の `prefers-color-scheme: dark` で変数を切り替えて行う。コンポーネントの CSS にダークモードの分岐を書かない

## テスト

- テストは `lib/` の純粋な関数だけを Vitest で書き、対象の隣に置く（`format.ts` と `format.test.ts`）
- API の応答を作り込むモックを使う画面のテストは書かない。応答の形を自前で再現すると、API とずれても気づけないため。画面の動きは `/implement` の完了条件で、実物の API に繋いで確かめる

## 禁止事項

- `lib/` から React・画面・CSS を import しない（上の「配置と依存の向き」）
- UI のコンポーネントライブラリを入れない
- openBD から取得したデータをリポジトリに入れない。テストやプレースホルダーの値は合成したものを使う（[ADR-002](adr/002-data-source.md)）
- 秘密情報（パスワード・トークンなど）をコードやドキュメントに書かない。接続先などは環境変数で受ける

## コマンド

`ui/` で実行する。

```bash
npm run format:check   # 整形の確認（整形するなら npm run format）
npm run lint           # ESLint（依存の向きも検査する）
npm run typecheck      # 型チェック
npm test               # Vitest（src/lib/ の関数のテスト）
npm run build          # ui/dist/ にビルドする
```

- Prettier の設定は `ui/.prettierrc.json`（`semi: false`・`singleQuote: true`・`printWidth: 100`）、ESLint の設定は `ui/eslint.config.js`
- Claude Code が UI のファイルを編集すると、フックが Prettier と `eslint --fix` を流す（`.css` は Prettier だけ）。自動で直せない違反は Claude に返る。Bash で書き換えた場合も、書き換えの後に流す
- 型チェックはフックで流さない。複数のファイルにまたがる変更の途中で、まだ直していないファイルのエラーが毎回返るため。`/implement` の完了条件の検証で流す
