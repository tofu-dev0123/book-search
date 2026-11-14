#!/usr/bin/env bash
# Bash の前後で .py と UI のファイル（ui/src/ の .ts・.tsx・.css）の変化を検出し、
# 変わったファイルに Edit の経路と同じフックの処理を流す。
# ruff.sh・prettier-eslint.sh・coding-rules.sh は matcher が Edit|Write|MultiEdit で、Bash で書き換えたときは動かないため。
#
# 引数 snapshot（PreToolUse）: 対象のファイルのハッシュを tool_use_id ごとに保存する
# 引数 check（PostToolUse・PostToolUseFailure）: ハッシュを取り直し、変わったファイルに
#   ruff.sh（.py）か prettier-eslint.sh（UI のファイル）と、coding-rules.sh after を流す。
#   返す内容があれば exit 2 で Claude に返す
set -euo pipefail

mode=$1
input=$(cat)
tool_use_id=$(jq -r '.tool_use_id // ""' <<<"$input")
session=$(jq -r '.session_id // ""' <<<"$input")
project=${CLAUDE_PROJECT_DIR:-$(pwd)}
hooks="$project/.claude/hooks"
snapshot_dir="${TMPDIR:-/tmp}/book-search-bash-edit"

[[ -n "$tool_use_id" ]] || exit 0

# git のコマンドだけの呼び出し（git switch・git checkout -- <file> など）は対象にしない。
# 自分が書いていないファイルにフォーマッタが流れたり、意味の通らない見直しの指示が返ったりするため。
# 単独の &（バックグラウンド実行）とコマンド置換の中は区切らないので、git で始まればその中の書き換えは見逃す
segments=$(jq -r '.tool_input.command // "" | gsub("&&|\\|\\||;|\\|"; "\n")' <<<"$input")
if ! grep -Evq '^[[:space:]]*(git([[:space:]]|$)|$)' <<<"$segments"; then
  exit 0
fi

cd "$project"
hashes() {
  # pathspec の * は / をまたいで一致するので、ui/src/ の下の階層も含む
  git ls-files -co --exclude-standard -z -- '*.py' 'ui/src/*.ts' 'ui/src/*.tsx' 'ui/src/*.css' |
    xargs -0 shasum 2>/dev/null | sort || true
}

if [[ "$mode" == "snapshot" ]]; then
  mkdir -p "$snapshot_dir"
  hashes >"$snapshot_dir/$tool_use_id"
  exit 0
fi

before="$snapshot_dir/$tool_use_id"
[[ -f "$before" ]] || exit 0
# ハッシュが変わったものと新しく作られたもの。削除されたものは流す対象がないので含めない
changed=$(comm -13 "$before" <(hashes) | cut -c43-)
rm -f "$before"
[[ -n "$changed" ]] || exit 0

feedback=""
while IFS= read -r path; do
  hook_input=$(jq -nc --arg s "$session" --arg p "$project/$path" '{session_id: $s, tool_input: {file_path: $p}}')
  if [[ "$path" == *.py ]]; then
    format="$hooks/ruff.sh"
  else
    format="$hooks/prettier-eslint.sh"
  fi
  if ! out=$("$format" <<<"$hook_input" 2>&1); then
    feedback+="$out"$'\n'
  fi
  # 本文は言語ごとにセッションで1回だけ返る（2回目以降は coding-rules.sh が何も返さない）
  if ! out=$("$hooks/coding-rules.sh" after <<<"$hook_input" 2>&1); then
    feedback+="$out"$'\n'
  fi
done <<<"$changed"

if [[ -n "$feedback" ]]; then
  echo "Bash で書き換えたファイルに、Edit の経路と同じフックの処理を流した。" >&2
  echo "$feedback" >&2
  exit 2
fi
exit 0
