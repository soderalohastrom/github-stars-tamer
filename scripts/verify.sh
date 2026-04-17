#!/usr/bin/env bash
#
# Verify script — called by the tester agent to check changed files and run affected tests.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Gather changed files ──
CHANGED=$(git -C "$PROJECT_ROOT" diff --name-only HEAD 2>/dev/null || true)
STAGED=$(git -C "$PROJECT_ROOT" diff --name-only --cached 2>/dev/null || true)
ALL_CHANGED=$(printf '%s\n%s' "$CHANGED" "$STAGED" | sort -u | grep -v '^$' || true)

if [ -z "$ALL_CHANGED" ]; then
  echo "verify: no changes detected, skipping"
  exit 0
fi

# ── Show the diff ──
echo "═══ Git Diff ═══"
git -C "$PROJECT_ROOT" diff --stat HEAD 2>/dev/null || true
echo ""

echo "Changed files:"
echo "$ALL_CHANGED" | sed 's/^/  /'
echo ""

# ── Test file pattern matching ──
is_test_file() {
  case "$1" in
    convex/__tests__/*.test.ts|convex/__tests__/*.test.tsx|*.spec.ts|*.spec.tsx)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

# ── Find affected test files ──
AFFECTED_TESTS=""
SOURCE_FILES=$(echo "$ALL_CHANGED" | while IFS= read -r f; do
  is_test_file "$f" || echo "$f"
done)

# Strategy 1: codegraph affected (preferred — traces import dependencies)
if command -v codegraph >/dev/null 2>&1 && [ -d "$PROJECT_ROOT/.codegraph" ]; then
  if [ -n "$SOURCE_FILES" ]; then
    CG_RESULTS=$(echo "$SOURCE_FILES" | codegraph affected --stdin --filter "convex/__tests__/*" --quiet --path "$PROJECT_ROOT" 2>/dev/null || true)
    if [ -n "$CG_RESULTS" ]; then
      AFFECTED_TESTS="$CG_RESULTS"
      echo "codegraph affected test files:"
      echo "$CG_RESULTS" | sed 's/^/  /'
      echo ""
    fi
  fi
fi

# Strategy 2: test files directly in the diff
CHANGED_TESTS=$(echo "$ALL_CHANGED" | while IFS= read -r f; do
  is_test_file "$f" && echo "$f"
done || true)

ALL_AFFECTED=$(printf '%s\n%s' "$AFFECTED_TESTS" "$CHANGED_TESTS" | sort -u | grep -v '^$' || true)

if [ -z "$ALL_AFFECTED" ]; then
  echo "No affected test files found."
  exit 0
fi

echo "Running affected tests:"
echo "$ALL_AFFECTED" | sed 's/^/  /'
echo ""

# ── Run only affected tests ──
SPEC_FILES=$(echo "$ALL_AFFECTED" | tr '\n' ' ')
cd "$PROJECT_ROOT" && npx vitest run $SPEC_FILES
