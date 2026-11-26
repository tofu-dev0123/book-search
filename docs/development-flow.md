# 開発フロー

Issue の起票から PR のマージまでの手順。起票から PR までは conventions が配る issue-driven の流れに従い、ここには book-search で足すことと、マージの方針だけを書く。

| 工程 | 担当 | 定義 |
|---|---|---|
| 起票 | `/feature`・`/bugfix` | `.claude/skills/feature/`・`.claude/skills/bugfix/`（配布物） |
| 実装 → PR | `/implement <Issue番号>` | `.claude/skills/implement/`（配布物） |
| レビュー | `reviewer` サブエージェント（`/implement` から呼ぶ） | `.claude/agents/reviewer.md`（配布物）と、固有の観点の [.claude/review.md](../.claude/review.md) |
| マージ | 人 | GitHub 上で PR を読んでマージする |

ラベル・ブランチ名・コミットの type・Issue の必須の節は `.claude/rules/shared/issue-driven.md`、ブランチを切る元と PR の宛先は `.claude/rules/shared/branch-flow.md`（どちらも配布物）にある。配布物は手で直さない。変えるときは conventions 側で直して配る。

## Issue に足すこと

issue-driven のテンプレート（`.github/ISSUE_TEMPLATE/`）の節に加えて、次を書く。

| 節 | 書くとき | 中身 |
|---|---|---|
| 評価 | 検索の挙動を変えうるとき | 検索結果を変えるか。変える場合は測定方法と採用の基準。測らない場合はその理由 |
| 設計判断 | 判断があるとき | 根拠（実測値は日付と条件つき）と、採らない案・その理由 |

- 決定済みの技術（CLAUDE.md の「決定済みの技術」）を覆す場合は、ADR の追加を やること に入れる
- 起票後に設計が変わったら、本文を直接更新し、変更点をコメントに残す

## 評価

検索結果を変える変更は、評価セット（[evaluation.md](evaluation.md)）で `main` とブランチの nDCG を測り、PR に前後の比較を載せる。測っていない改善を「良くなった」と書かない。

レビューでは、検索結果を変える差分に nDCG の前後比較がなければ必須の指摘になる（[.claude/review.md](../.claude/review.md) の R2）。

## 検証

- `./scripts/check`：ruff（整形の確認・lint）・pytest（ES が要るテストは除く）・UI の lint・整形の確認・型・テスト・ビルド。`/implement` が実行する
- `./scripts/format <ファイル>`：整形と lint の自動修正。Claude Code が編集したファイルごとにフックが呼ぶ

## マージ

- Merge commit のみ（squash・rebase はリポジトリ設定で無効にしている）。やること 単位のコミットを `main` の履歴に残すため
- マージ後のブランチは自動で削除される
- `main` への直接 push は、フックと branch protection で止めている
