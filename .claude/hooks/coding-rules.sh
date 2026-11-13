#!/usr/bin/env bash
# PreToolUse フック: セッションで最初の .py の編集を止め、docs/coding-rules.md の本文を Claude に返す。
# 止めずに渡すと本文はその編集の後に届くので、最初の編集から従わせるために exit 2 で止める。
# 2回目以降は止めない（session_id ごとの印を一時ディレクトリに置く）。
set -euo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // ""' <<<"$input")
session=$(jq -r '.session_id // ""' <<<"$input")
project=${CLAUDE_PROJECT_DIR:-$(pwd)}

# プロジェクト外のファイルと .py 以外は対象にしない
[[ "$path" == *.py && "$path" == "$project"/* && -n "$session" ]] || exit 0

marker_dir="${TMPDIR:-/tmp}/book-search-coding-rules"
marker="${marker_dir}/${session}"
[[ -e "$marker" ]] && exit 0

mkdir -p "$marker_dir"
touch "$marker"
{
  echo "ブロック: このセッションで最初の .py の編集なので、先に実装ルール（docs/coding-rules.md）を返す。"
  echo "ルールに沿って編集をやり直すこと。このセッションでは以後止めない。"
  echo
  cat "$project/docs/coding-rules.md"
} >&2
exit 2
