#!/bin/bash
#
# Test and Commit Script
# Runs all tests (build, lint, typecheck, unit, e2e) and commits only if all pass with no warnings
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
FAILED=0

echo "=========================================="
echo "  Web Extensions Test and Commit Script"
echo "=========================================="
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Step 1: Build
echo -e "${YELLOW}[1/5] Building all packages...${NC}"
if pnpm build; then
    echo -e "${GREEN}✓ Build passed${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    FAILED=1
fi
echo ""

# Step 2: Typecheck
echo -e "${YELLOW}[2/5] Running typecheck...${NC}"
if pnpm check:types; then
    echo -e "${GREEN}✓ Typecheck passed${NC}"
else
    echo -e "${RED}✗ Typecheck failed${NC}"
    FAILED=1
fi
echo ""

# Step 3: Linter (with --max-warnings=0 to fail on warnings)
echo -e "${YELLOW}[3/5] Running linter (no warnings allowed)...${NC}"
LINT_FAILED=0

# Lint photo-addon
if pnpm eslint 'packages/web-app-photo-addon/**/*.{js,ts,vue}' --color --max-warnings=0; then
    echo -e "${GREEN}  ✓ photo-addon linter passed${NC}"
else
    echo -e "${RED}  ✗ photo-addon linter failed${NC}"
    LINT_FAILED=1
fi

# Lint advanced-search
if pnpm eslint 'packages/web-app-advanced-search/**/*.{js,ts,vue}' --color --max-warnings=0; then
    echo -e "${GREEN}  ✓ advanced-search linter passed${NC}"
else
    echo -e "${RED}  ✗ advanced-search linter failed${NC}"
    LINT_FAILED=1
fi

if [ $LINT_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Linter passed (no warnings)${NC}"
else
    echo -e "${RED}✗ Linter failed or has warnings${NC}"
    FAILED=1
fi
echo ""

# Step 4: Unit tests
echo -e "${YELLOW}[4/5] Running unit tests...${NC}"
if pnpm test:unit; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
else
    echo -e "${RED}✗ Unit tests failed${NC}"
    FAILED=1
fi
echo ""

# Step 5: E2E tests (skip if credentials not set or browsers not available)
echo -e "${YELLOW}[5/5] Checking for E2E tests...${NC}"

# Check if E2E can run
E2E_SKIP_REASON=""
if [ -z "$OCIS_PASSWORD" ]; then
    E2E_SKIP_REASON="OCIS_PASSWORD not set"
fi

if [ -n "$E2E_SKIP_REASON" ]; then
    echo -e "${YELLOW}⊘ E2E tests skipped ($E2E_SKIP_REASON)${NC}"
    echo "  Set OCIS_PASSWORD environment variable to run E2E tests"
else
    if [ -d "packages/web-app-photo-addon/tests/e2e" ] || [ -d "packages/web-app-advanced-search/tests/e2e" ]; then
        if pnpm test:e2e --project=photo-addon --project=advanced-search; then
            echo -e "${GREEN}✓ E2E tests passed${NC}"
        else
            echo -e "${RED}✗ E2E tests failed${NC}"
            FAILED=1
        fi
    else
        echo -e "${GREEN}✓ No E2E tests to run (skipped)${NC}"
    fi
fi
echo ""

# Summary
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    echo ""

    # Show git status
    echo "Changes to be committed:"
    git status --short
    echo ""

    # Prompt for commit message
    read -p "Enter commit message (or 'skip' to abort): " COMMIT_MSG

    if [ "$COMMIT_MSG" = "skip" ]; then
        echo "Commit aborted."
        exit 0
    fi

    # Stage and commit
    echo ""
    echo "Staging changes..."
    git add -A packages/web-app-photo-addon/
    git add -A packages/web-app-advanced-search/

    echo "Creating commit..."
    git commit -m "$(cat <<EOF
$COMMIT_MSG

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

    echo -e "${GREEN}✓ Commit created successfully${NC}"
    echo ""
    echo "To push: git push origin $(git branch --show-current)"
else
    echo -e "${RED}Tests failed! Commit aborted.${NC}"
    echo "Please fix the issues above before committing."
    exit 1
fi
