#!/usr/bin/env bash
# PreToolUse × Bash: コミット・PR に AI の生成証跡が混入するのをブロックする。
# ルールに書くだけでは遵守率 ~80% なので、フックで 100% にする。
set -uo pipefail

# --user: ユーザー層（~/.claude）から呼ばれた。プロジェクトに同名のフックがあれば、そちらに任せる
#   - 中身が自分と同じときだけ任せる（空のファイルなどを置かれてガードを外されないため）
#   - ~ で開いたときはプロジェクトのフックが自分自身になるので、そのときは任せない
if [[ "${1:-}" == "--user" && -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  project_hook="$CLAUDE_PROJECT_DIR/.claude/hooks/$(basename "$0")"
  if [[ -f "$project_hook" && ! "$project_hook" -ef "$0" ]] && cmp -s "$project_hook" "$0"; then
    exit 0
  fi
fi

input=$(cat)
# jq が失敗しても Bash ツール全体を巻き込まない（フックのエラーで作業を止めない）
command=$(jq -r '.tool_input.command // ""' <<<"$input" 2>/dev/null) || exit 0

case "$command" in
  *"git commit"*|*"gh pr create"*) ;;
  *) exit 0 ;;
esac

if grep -qiE 'Co-Authored-By:[[:space:]]*Claude' <<<"$command"; then
  echo "ブロック: コミットメッセージに Co-Authored-By: Claude 行を付けない規約があります。該当行を削除して再実行してください。" >&2
  exit 2
fi

if grep -qiE 'Generated with \[Claude Code\]|🤖 Generated with' <<<"$command"; then
  echo "ブロック: PR 本文に 'Generated with [Claude Code]' フッターを付けない規約があります。該当行を削除して再実行してください。" >&2
  exit 2
fi

exit 0
