"""サブパッケージ間の依存の向きを検査する（#17）。"""

import ast
from pathlib import Path

import pytest

PACKAGE = "book_search"
PACKAGE_DIR = Path(__file__).parents[1] / "src" / PACKAGE

# サブパッケージごとの、自分以外に依存してよいパッケージ内のサブパッケージ
ALLOWED = {
    "api": {"search"},
    "evaluation": {"search"},
    "search": set(),
    "ingest": set(),
}


def imported_subpackages(path: Path) -> set[str]:
    """モジュールが import しているパッケージ内のサブパッケージを返す。"""
    found = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            # from book_search import search のように、サブパッケージを名前で import する書き方も拾う
            names = [node.module] + [f"{node.module}.{alias.name}" for alias in node.names]
        else:
            continue
        for name in names:
            parts = name.split(".")
            if parts[0] == PACKAGE and len(parts) > 1:
                found.add(parts[1])
    return found


def modules() -> list[Path]:
    return sorted(p for p in PACKAGE_DIR.rglob("*.py") if p.parent != PACKAGE_DIR)


def test_every_subpackage_has_rule():
    subpackages = {p.relative_to(PACKAGE_DIR).parts[0] for p in modules()}

    assert subpackages <= ALLOWED.keys()


def test_relative_imports_are_not_used():
    # 相対 import は依存先を名前で判定できないので使わない
    for path in modules():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        assert not any(isinstance(n, ast.ImportFrom) and n.level > 0 for n in ast.walk(tree)), path


@pytest.mark.parametrize("path", modules(), ids=lambda p: str(p.relative_to(PACKAGE_DIR)))
def test_imports_follow_dependency_direction(path):
    own = path.relative_to(PACKAGE_DIR).parts[0]

    assert imported_subpackages(path) - {own} <= ALLOWED[own]
