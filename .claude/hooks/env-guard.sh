#!/usr/bin/env bash
# PreToolUse: .env への読み書き・検索・参照をブロックする（.env.example は許可）。
# exit 2 で該当のツール呼び出しをブロックし、stderr が Claude に返る。
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
tool=$(jq -r '.tool_name // ""' <<<"$input" 2>/dev/null) || exit 0

is_env_path() {
  local name
  name=$(basename "$1")
  [[ "$name" =~ ^\.env(\..+)?$ && "$name" != ".env.example" ]]
}

# glob の末尾の要素が .env に当たりうるか（.env.example だけの指定は許す）
#   ブレース・文字クラス（.env{,.local}・.[e]nv・*.{env,local}）は、記号を外した形に env があれば止める
is_env_glob() {
  local name=$1 flat
  [[ "$name" == ".env.example" ]] && return 1
  [[ "$name" =~ ^[*?]*\.env([.*?].*)?$ ]] && return 0
  if [[ "$name" == *[\{\[]* ]]; then
    flat=${name//[\[\]\{\},]/}
    [[ "$flat" == *env* ]] && return 0
  fi
  return 1
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
    # ファイル名の絞り込み（Grep の glob・Glob の pattern）も見る。
    # 末尾の要素が .env に当たりうる指定（.env・.env.local・.env*・*.env・**/.env）を止める
    while IFS= read -r spec; do
      [[ -n "$spec" ]] || continue
      if is_env_glob "${spec##*/}"; then
        block ".env ファイルに当たりうる指定（${spec}）では検索しない"
      fi
    done < <(jq -r '.tool_input.glob // empty, (if .tool_name == "Glob" then .tool_input.pattern // empty else empty end)' <<<"$input")
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
    if grep -Eq '(^|[^A-Za-z0-9_.-])\.env(\.[A-Za-z0-9_-]+)?($|[^A-Za-z0-9_.-])' <<<"${cmd//.env.example/}"; then
      block ".env ファイルを参照するコマンドは実行しない"
    fi
    ;;
esac

exit 0
