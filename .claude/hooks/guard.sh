#!/usr/bin/env bash
# PreToolUse フック: main への直接 push と .env へのアクセスを止める。
# exit 2 で該当のツール呼び出しをブロックし、stderr が Claude に返る。
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")

# .env / .env.local などを対象にし、.env.example は除外する
is_env_path() {
  local name
  name=$(basename "$1")
  [[ "$name" =~ ^\.env(\..+)?$ && "$name" != ".env.example" ]]
}

block() {
  echo "ブロック: $1" >&2
  exit 2
}

case "$tool" in
  Read|Edit|Write|MultiEdit|NotebookEdit)
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
    if [[ -n "$path" ]] && is_env_path "$path"; then
      block ".env ファイル（${path}）は読み書きしない。必要な値はユーザーに確認すること"
    fi
    ;;
  Grep|Glob)
    path=$(jq -r '.tool_input.path // ""' <<<"$input")
    if [[ -n "$path" ]] && is_env_path "$path"; then
      block ".env ファイル（${path}）は検索しない"
    fi
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")

    # .env を参照するコマンド（.env.example は許可）
    if grep -Eq '(^|[^A-Za-z0-9_.-])\.env(\.[A-Za-z0-9_-]+)?($|[^A-Za-z0-9_.-])' <<<"${cmd//.env.example/}"; then
      block ".env ファイルを参照するコマンドは実行しない"
    fi

    # main への push
    if grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)' <<<"$cmd"; then
      # 同じ行の別コマンド（gh pr create --base main など）を拾わないよう、push の引数だけを見る
      push_args=$(grep -Eo 'push([[:space:]]+[^;&|]*)?' <<<"$cmd" || true)
      if grep -Eq '(^|[[:space:]:+])main([[:space:]]|$)' <<<"$push_args"; then
        block "main への push は禁止。feature/issue#<番号> ブランチから PR を作ること"
      fi
      branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null || true)
      if [[ "$branch" == "main" ]]; then
        block "現在のブランチが main なので push しない。feature/issue#<番号> ブランチを切ること"
      fi
    fi
    ;;
esac

exit 0
