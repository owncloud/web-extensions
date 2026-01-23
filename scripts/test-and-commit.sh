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
echo "  Photo-Addon Test and Commit Script"
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
echo -e "${YELLOW}[3/5] Running linter on photo-addon (no warnings allowed)...${NC}"
if pnpm eslint 'packages/web-app-photo-addon/**/*.{js,ts,vue}' --color --max-warnings=0; then
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

# Step 5: E2E tests (skip if none exist)
echo -e "${YELLOW}[5/5] Checking for E2E tests...${NC}"
if [ -d "tests/e2e" ] || [ -d "packages/web-app-photo-addon/tests/e2e" ]; then
    if pnpm test:e2e; then
        echo -e "${GREEN}✓ E2E tests passed${NC}"
    else
        echo -e "${RED}✗ E2E tests failed${NC}"
        FAILED=1
    fi
else
    echo -e "${GREEN}✓ No E2E tests to run (skipped)${NC}"
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

    echo "Creating commit..."
    git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

    echo -e "${GREEN}✓ Commit created successfully${NC}"
    echo ""
    echo "To push: git push origin $(git branch --show-current)"
else
    echo -e "${RED}Tests failed! Commit aborted.${NC}"
    echo "Please fix the issues above before committing."
    exit 1
fi
