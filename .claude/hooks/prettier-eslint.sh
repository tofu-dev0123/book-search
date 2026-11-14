#!/usr/bin/env bash
# PostToolUse フック: 編集した UI のファイル（ui/src/ の .ts・.tsx・.css）に Prettier と ESLint を流す。
# .ts・.tsx には prettier --write と eslint --fix、.css には prettier --write だけを流す。
# 自動で直せない違反が残ったら exit 2 で、違反の内容を stderr で Claude に返す。
# 型チェックは流さない（複数のファイルにまたがる変更の途中で、まだ直していないファイルのエラーが毎回返るため）。
set -euo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // ""' <<<"$input")
project=${CLAUDE_PROJECT_DIR:-$(pwd)}

# ui/src/ の .ts・.tsx・.css 以外は対象にしない
case "$path" in
  "$project"/ui/src/*.ts | "$project"/ui/src/*.tsx | "$project"/ui/src/*.css) ;;
  *) exit 0 ;;
esac
[[ -f "$path" ]] || exit 0

cd "$project/ui"
bin=node_modules/.bin
if [[ ! -x "$bin/prettier" || ! -x "$bin/eslint" ]]; then
  echo "ui/node_modules に Prettier・ESLint がないので流せなかった。cd ui && npm ci を流すこと" >&2
  exit 2
fi
if ! out=$("$bin/prettier" --write --log-level warn "$path" 2>&1); then
  echo "Prettier に失敗した: ${path}" >&2
  echo "$out" >&2
  exit 2
fi
[[ "$path" == *.css ]] && exit 0
if ! out=$("$bin/eslint" --fix "$path" 2>&1); then
  echo "ESLint で自動で直せない違反が残った: ${path}" >&2
  echo "$out" >&2
  exit 2
fi

exit 0
