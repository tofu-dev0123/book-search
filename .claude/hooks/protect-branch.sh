#!/usr/bin/env bash
# PreToolUse × Bash: 守るブランチへの直接 push をブロックする。
#
# 使い方: protect-branch.sh <ブランチ>...
#   守るブランチは flow プロファイルの settings.json が引数で渡す（branch-flow.md と同じもの）。
#   フックは Markdown を読まない。抜け道（環境変数での許可など）も作らない。
#
# 止めるもの:
#   - refspec に守るブランチがある        git push origin main / HEAD:develop / refs/heads/main / heads/main
#   - --all / --mirror / --branches        すべてのブランチを送る（省略形 --mirr なども）
#   - refspec が無い・HEAD / @ だけで、今いるブランチが守るブランチ   git push / git push -u origin
#   - push の引数に変数展開・コマンド置換・{ } がある、refspec に * がある（判定できないため）
#   - コマンドを字句解析できない（引用符の閉じ忘れなど）のに push を含む
#   - bash -c "..."・eval "..." の中の git push（中身を解析し直す）、コマンド置換の中の git push
# タグの push（git push origin v1.2.0）は止めない。
#
# コマンドの切り分けは Python の shlex に任せる。引用符・エスケープ・; & | の扱いをシェルにそろえ、
# 文字列置換による食い違い（'git' push や \; を区切りと誤認するなど）を起こさないため。
#
# 目的は Claude の誤操作を止めること。git の alias 経由の push などは対象外
# （人の操作も含めて止めるなら、サーバ側のブランチ保護が要る）。
set -uo pipefail

(( $# > 0 )) || exit 0

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input" 2>/dev/null) || exit 0
[[ "$cmd" == *push* ]] || exit 0

python3 - "$cmd" "${CLAUDE_PROJECT_DIR:-.}" "$@" <<'PY'
import os
import re
import shlex
import subprocess
import sys

cmd, project_dir, *protected = sys.argv[1:]

PUNCTUATION = ";&|<>()"
GLOBAL_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}
PUSH_WITH_VALUE = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}


def block(what: str) -> None:
    print(
        f"ブロック: {what} への直接 push は禁止（branch-flow.md）。\n"
        "作業ブランチを切って PR を作ること。昇格は /release で PR を作る。",
        file=sys.stderr,
    )
    sys.exit(2)


def current_branch(directory: str) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", directory, "branch", "--show-current"],
            capture_output=True, text=True, check=False,
        )
        return out.stdout.strip()
    except OSError:
        return ""


def normalize(ref: str, directory: str) -> str:
    ref = ref.lstrip("+")
    if ref in ("HEAD", "@"):
        ref = current_branch(directory)
    if ref.startswith("refs/"):
        ref = ref[len("refs/"):]
    if ref.startswith("heads/"):
        ref = ref[len("heads/"):]
    return ref


def is_all_branches(option: str) -> bool:
    name = option[2:].split("=", 1)[0]
    return len(name) >= 2 and any(word.startswith(name) for word in ("all", "mirror", "branches"))


# 行継続（バックスラッシュ＋改行）はシェルと同じく字句解析の前に消す
cmd = cmd.replace("\\\n", "")

# エスケープ・引用符で囲んだ区切り記号だけの語（\; ';' "&&" など）は、字句解析の後では
# 本物の区切りと見分けられない。push の引数に紛れ込ませられるので、判定せずに止める
if re.search(r"""\\[;&|<>()]|'[;&|<>()]+'|"[;&|<>()]+\"""", cmd):
    block("判定できないコマンド（エスケープ・引用符で囲んだ区切り記号がある）")
GIT_PUSH = re.compile(r"\bgit\b.*\bpush\b", re.S)

# コマンド置換（` ` と $( )）の中の git push は、展開後の形を判定できないので止める
for inner in re.findall(r"`[^`]*`|\$\([^)]*\)", cmd):
    if GIT_PUSH.search(inner):
        block("判定できないコマンド（コマンド置換の中に git push がある）")


def lex(text: str) -> list[str]:
    lexer = shlex.shlex(text, posix=True, punctuation_chars=PUNCTUATION)
    lexer.whitespace_split = True
    lexer.commenters = ""
    return list(lexer)


def split_commands(tokens: list[str]) -> list[list[str]]:
    """引用符の外にある区切り記号でコマンドごとに分ける（引用符・エスケープされた ; は区切りにしない）。"""
    commands, current = [], []
    for token in tokens:
        if token and set(token) <= set(PUNCTUATION):
            commands.append(current)
            current = []
        else:
            current.append(token)
    commands.append(current)
    return commands


def check_push(words: list[str], i: int) -> None:
    """words[i] が git のとき、global オプションの後に push が続けば判定する。"""
    directory = project_dir
    j = i + 1
    while j < len(words) and words[j].startswith("-"):
        option = words[j]
        if option in GLOBAL_WITH_VALUE and j + 1 < len(words):
            if option == "-C":
                directory = words[j + 1]
            j += 2
        else:
            j += 1
    if j >= len(words) or words[j] != "push":
        return

    args = words[j + 1:]
    if any(c in arg for arg in args for c in "$`{}"):
        block(f"判定できない push の引数（{' '.join(args)}）")

    remote, refspecs, skip_next = None, [], False
    for arg in args:
        if skip_next:
            skip_next = False
            continue
        if arg in PUSH_WITH_VALUE:
            skip_next = True
        elif arg.startswith("--"):
            if is_all_branches(arg):
                block(f"すべてのブランチ（{arg}）")
        elif arg.startswith("-"):
            continue
        elif remote is None:
            remote = arg
        else:
            refspecs.append(arg)

    if not refspecs:
        branch = current_branch(directory)
        if branch and branch in protected:
            block(branch)
        return

    for spec in refspecs:
        if "*" in spec:
            block(f"ワイルドカードの refspec（{spec}）")
        dst = spec.split(":", 1)[1] if ":" in spec else spec
        if dst and normalize(dst, directory) in protected:
            block(normalize(dst, directory))


def analyze(text: str, depth: int = 0) -> None:
    if depth > 3:
        block("判定できないコマンド（入れ子が深すぎる）")
    try:
        tokens = lex(text)
    except ValueError:
        block("判定できないコマンド（字句解析に失敗。引用符の閉じ忘れなど）")
    for words in split_commands(tokens):
        for i, word in enumerate(words):
            # bash -c "git push ..."・eval "..." のように、1語の中にコマンドが入っていれば解析し直す
            if any(ch.isspace() for ch in word) and GIT_PUSH.search(word):
                analyze(word, depth + 1)
            elif os.path.basename(word) == "git":
                check_push(words, i)


# 全体を1つとして解析し、改行がある場合は各行も解析する（改行もコマンドの区切りのため）
analyze(cmd)
if "\n" in cmd:
    for line in cmd.splitlines():
        try:
            lex(line)
        except ValueError:
            continue  # 引用符の中の改行で切れた行。全体の解析で見ている
        analyze(line)

sys.exit(0)
PY
