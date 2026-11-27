#!/usr/bin/env bash
# SessionStart: conventions から配る中身が、このリポジトリに未反映なら通知する。
#
# ローカル CLI 方式の弱点は「sync を忘れると古いまま」であること。
# 配布を自動化するのではなく、ズレを知らせることで解く。
#   - .synced.json に target があれば、conventions の sync.py --check <target> で実際の差分を見る。
#     配る中身に差分があるときだけ通知する（関係のない conventions のコミットでは通知しない）
#   - target の無い古い形式なら、.synced.json の source とコミット ID を比べる
#   - conventions が無い・sync.py がエラーになったときは何も出さない（通知は補助のため）
set -uo pipefail

central=${CONVENTIONS_DIR:-$HOME/dev/conventions}
project=${CLAUDE_PROJECT_DIR:-$(pwd)}
manifest="$project/.claude/.synced.json"

[[ -f "$manifest" && -d "$central/.git" ]] || exit 0

target=$(jq -r '.target // ""' "$manifest" 2>/dev/null) || exit 0

if [[ -n "$target" ]]; then
  # 中止（untracked・drifted）でも終了コードは 1 になるので、終了コードではなく出力で判断する。
  # エラー（targets.toml に無い名前など）は stderr に出て、標準出力に結果が無い
  out=$("$central/tools/bin/sync.py" --check "$target" 2>/dev/null)
  grep -q "^${target} (" <<<"$out" || exit 0
  if grep -q '⚠' <<<"$out"; then
    echo "conventions の配布が止まっています（${target}）。'cd ${central} && ./tools/bin/sync.py --check ${target}' で理由を確かめてください。"
  elif grep -Eq '^  [+~-] ' <<<"$out"; then
    echo "conventions から配る中身が更新されています（${target}）。'cd ${central} && ./tools/bin/sync.py ${target}' を実行してください。"
  fi
  exit 0
fi

local_sha=$(jq -r '.source // ""' "$manifest" 2>/dev/null | sed 's/.*@//')
central_sha=$(git -C "$central" rev-parse --short HEAD 2>/dev/null) || exit 0

[[ -n "$local_sha" && -n "$central_sha" ]] || exit 0

if [[ "$local_sha" != "$central_sha" ]]; then
  echo "conventions が更新されています（${local_sha} → ${central_sha}）。'cd ${central} && ./tools/bin/sync.py' を実行してください。"
fi

exit 0
