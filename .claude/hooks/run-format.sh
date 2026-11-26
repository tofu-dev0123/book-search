#!/usr/bin/env bash
# PostToolUse × Edit / Write / MultiEdit: 編集したファイルを、リポジトリの ./scripts/format で整形する。
#
# 整形・lint の中身（どのツールを、どこで実行するか）はリポジトリごとに違うので、
# 各リポジトリが手書きする ./scripts/format <ファイル> に任せる。このフックは呼ぶだけ。
#   - ./scripts/format が無い・実行できないときは何もしない
#   - リポジトリの外のファイルは対象にしない
#   - ファイルはリポジトリ直下からの相対パスで渡し、リポジトリ直下で実行する
#   - 失敗したら exit 2 で出力を Claude に返し、直させる
set -uo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // ""' <<<"$input" 2>/dev/null) || exit 0
[[ -n "$path" && -f "$path" ]] || exit 0

root=$(cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null && pwd -P) || exit 0
format="$root/scripts/format"
[[ -x "$format" ]] || exit 0

dir=$(cd "$(dirname "$path")" 2>/dev/null && pwd -P) || exit 0
[[ "$dir" == "$root" || "$dir" == "$root"/* ]] || exit 0
rel="${dir#"$root"}/$(basename "$path")"
rel=${rel#/}
# - で始まるとオプションとして読まれるので、./ を付ける（相対パスのまま）
[[ "$rel" == -* ]] && rel="./$rel"

if ! out=$(cd "$root" && ./scripts/format "$rel" 2>&1); then
  printf './scripts/format が失敗した: %s\n%s\n出力を見て %s を直す（整形で直らない lint の違反など）。直したら編集し直すと、もう一度整形される。\n' "$rel" "$out" "$rel" >&2
  exit 2
fi

exit 0
