#!/usr/bin/env bash
# PostToolUse フック: 編集した .py に ruff format と ruff check --fix を流す。
# 自動で直せない違反が残ったら exit 2 で、違反の内容を stderr で Claude に返す。
set -euo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // ""' <<<"$input")
project=${CLAUDE_PROJECT_DIR:-$(pwd)}

# プロジェクト外のファイルと .py 以外は対象にしない
[[ "$path" == *.py && "$path" == "$project"/* && -f "$path" ]] || exit 0

cd "$project"
if ! out=$(uv run --quiet ruff format "$path" 2>&1); then
  echo "ruff format に失敗した: ${path}" >&2
  echo "$out" >&2
  exit 2
fi
if ! out=$(uv run --quiet ruff check --fix --output-format concise "$path" 2>&1); then
  echo "ruff check で自動で直せない違反が残った: ${path}" >&2
  echo "$out" >&2
  exit 2
fi

exit 0
