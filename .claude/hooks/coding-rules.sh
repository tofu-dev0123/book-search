#!/usr/bin/env bash
# PreToolUse フック: セッションで最初のその言語のファイルの編集を止め、実装ルールの本文を Claude に返す。
#   .py → docs/coding-rules.md、ui/src/ の .ts・.tsx・.css → docs/coding-rules-ui.md
# 止めずに渡すと本文はその編集の後に届くので、最初の編集から従わせるために exit 2 で止める。
# 2回目以降は止めない（session_id と言語ごとの印を一時ディレクトリに置く）。印を言語ごとに持つのは、
# Python を編集したあとに UI を編集しても、UI の文書が届くようにするため。
#
# 引数 after: Bash で書き換えた後に呼ぶ（bash-edit.sh から）。書き換えは済んでいるので止めずに、
# 本文と見直しの指示を返す。印は Edit の経路と共有し、どちらで渡してもセッションで1回だけにする。
set -euo pipefail

mode=${1:-before}
input=$(cat)
path=$(jq -r '.tool_input.file_path // ""' <<<"$input")
session=$(jq -r '.session_id // ""' <<<"$input")
project=${CLAUDE_PROJECT_DIR:-$(pwd)}

# プロジェクト外のファイルと、どちらの言語にも当たらないファイルは対象にしない
[[ "$path" == "$project"/* && -n "$session" ]] || exit 0
case "$path" in
  *.py)
    lang=py
    kind=" .py "
    doc=docs/coding-rules.md
    ;;
  "$project"/ui/src/*.ts | "$project"/ui/src/*.tsx | "$project"/ui/src/*.css)
    lang=ui
    kind=" UI のファイル"
    doc=docs/coding-rules-ui.md
    ;;
  *)
    exit 0
    ;;
esac

marker_dir="${TMPDIR:-/tmp}/book-search-coding-rules"
marker="${marker_dir}/${session}-${lang}"
[[ -e "$marker" ]] && exit 0

# 本文を読めなかったときに印だけが残り、以後ルールが渡らなくなるのを避けるため、印は読めてから置く
rules=$(cat "$project/$doc")
mkdir -p "$marker_dir"
touch "$marker"
{
  if [[ "$mode" == "after" ]]; then
    echo "このセッションで最初の${kind}の書き換えが Bash だったので、実装ルール（${doc}）を返す。"
    echo "この書き換えがルールに沿っているか見直し、沿っていなければ直すこと。このセッションでは以後返さない。"
  else
    echo "ブロック: このセッションで最初の${kind}の編集なので、先に実装ルール（${doc}）を返す。"
    echo "ルールに沿って編集をやり直すこと。このセッションでは以後止めない。"
  fi
  echo
  echo "$rules"
} >&2
exit 2
