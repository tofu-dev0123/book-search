#!/usr/bin/env bash
# PreToolUse フック: セッションで最初の .py の編集を止め、docs/coding-rules.md の本文を Claude に返す。
# 止めずに渡すと本文はその編集の後に届くので、最初の編集から従わせるために exit 2 で止める。
# 2回目以降は止めない（session_id ごとの印を一時ディレクトリに置く）。
#
# 引数 after: Bash で書き換えた後に呼ぶ（bash-py.sh から）。書き換えは済んでいるので止めずに、
# 本文と見直しの指示を返す。印は Edit の経路と共有し、どちらで渡してもセッションで1回だけにする。
set -euo pipefail

mode=${1:-before}
input=$(cat)
path=$(jq -r '.tool_input.file_path // ""' <<<"$input")
session=$(jq -r '.session_id // ""' <<<"$input")
project=${CLAUDE_PROJECT_DIR:-$(pwd)}

# プロジェクト外のファイルと .py 以外は対象にしない
[[ "$path" == *.py && "$path" == "$project"/* && -n "$session" ]] || exit 0

marker_dir="${TMPDIR:-/tmp}/book-search-coding-rules"
marker="${marker_dir}/${session}"
[[ -e "$marker" ]] && exit 0

# 本文を読めなかったときに印だけが残り、以後ルールが渡らなくなるのを避けるため、印は読めてから置く
rules=$(cat "$project/docs/coding-rules.md")
mkdir -p "$marker_dir"
touch "$marker"
{
  if [[ "$mode" == "after" ]]; then
    echo "このセッションで最初の .py の書き換えが Bash だったので、実装ルール（docs/coding-rules.md）を返す。"
    echo "この書き換えがルールに沿っているか見直し、沿っていなければ直すこと。このセッションでは以後返さない。"
  else
    echo "ブロック: このセッションで最初の .py の編集なので、先に実装ルール（docs/coding-rules.md）を返す。"
    echo "ルールに沿って編集をやり直すこと。このセッションでは以後止めない。"
  fi
  echo
  echo "$rules"
} >&2
exit 2
