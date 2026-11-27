#!/usr/bin/env bash
# PreToolUse × Bash: 生成物と個人用の設定への Bash 経由の書き込みをブロックする。
#
# permissions の deny は Edit / Write ツールしか見ないため、
# `sed -i` や `cat > ...` によるすり抜けが残る。そこをここで塞ぐ。
#   - 生成物：決め打ちのパスと、.claude/.synced.json に記録された配布物（スキル・エージェントなど）
#   - .claude/settings.local.json：即座に効き誰にも見えないため、Claude には書き換えさせない
set -uo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input" 2>/dev/null) || exit 0

# パスの前に付いてよいもの：./・このリポジトリの絶対パス（リンクを解決したものとしないもの）・
# $CLAUDE_PROJECT_DIR・$PWD（引用符付きも）。それ以外が前に付くもの（profiles/x/.claude/... のような正本）は当てない
regex_escape() { sed 's/[][\.*^$+?(){}|/]/\\&/g' <<<"$1"; }
project=${CLAUDE_PROJECT_DIR:-$PWD}
resolved=$(cd "$project" 2>/dev/null && pwd -P) || resolved=$project
prefix="(\./|$(regex_escape "$project")/|$(regex_escape "$resolved")/|\"?\\\$\{?(CLAUDE_PROJECT_DIR|PWD)\}?\"?/)"

# コマンドが、パス（正規表現）に書き込むか。
#   > >>・tee・sed -i は引数のどこかに、cp・mv・install は最後の引数（書き込み先）にあるときだけ当てる。
#   パスは、直前が行頭・空白・引用符・> のときだけ当てる
writes_to() {
  local p="${prefix}?$1" b='(^|[[:space:]"'"'"'=>])'
  grep -Eq ">>?[[:space:]]*[\"']?${p}" <<<"$cmd" && return 0
  grep -Eq "(tee|sed +-i)[^|;&]*${b}${p}" <<<"$cmd" && return 0
  grep -Eq "(cp|mv|install)[[:space:]][^|;&]*[[:space:]][\"']?${p}[\"']?[[:space:]]*($|[|;&])" <<<"$cmd"
}

block_generated() {
  cat >&2 <<'MSG'
ブロック: このファイルは conventions が生成・配布しています。手で変更しても次の sync で消えます。

  共通ルールを変える       → conventions/common/ を編集して ./tools/bin/sync.py
  フロー・開発の流れで変える → conventions/profiles/<name>/ を編集して ./tools/bin/sync.py
  このリポジトリだけ変える → .claude/project.settings.json を編集して ./tools/bin/sync.py
MSG
  exit 2
}

if writes_to '\.claude/settings\.local\.json'; then
  cat >&2 <<'MSG'
ブロック: .claude/settings.local.json は Claude からは書き換えない（即座に効き、コミットされないため誰にも見えない）。
  例外が要るなら、内容をユーザーに示して手で書いてもらうか、.claude/project.settings.json に書く。
MSG
  exit 2
fi

# 決め打ちの生成物
if writes_to '\.claude/(settings\.json|\.synced\.json|hooks/[^[:space:]]*|rules/shared/[^[:space:]]*)' \
   || writes_to '\.github/ISSUE_TEMPLATE/[^[:space:]]*'; then
  block_generated
fi

# .synced.json に記録された配布物（読めなければ決め打ちの判定だけで済ませる）
manifest="${CLAUDE_PROJECT_DIR:-.}/.claude/.synced.json"
if [[ -f "$manifest" ]]; then
  while IFS= read -r rel; do
    [[ -n "$rel" ]] || continue
    escaped=$(regex_escape "$rel")
    if writes_to "$escaped"; then
      block_generated
    fi
  done < <(jq -r '.files // {} | keys[]' "$manifest" 2>/dev/null)
fi

exit 0
