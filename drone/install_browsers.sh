#!/bin/bash

playwright_version=""
get_playwright_version() {
    local version
    if [[ ! -f "package.json" ]]; then
        echo "[ERROR] package.json file not found."
        exit 1
    fi

    version=$(jq '.devDependencies["@playwright/test"]' <package.json | sed s/\"//g)

    if [[ -z "$version" || "$version" == "null" ]]; then
        echo "[ERROR] Playwright package not found in package.json." >&2
        exit 1
    fi

    echo "$version"
}

playwright_version=$(get_playwright_version)
if [[ -z "$playwright_version" ]]; then
    exit 1
fi

BROWSERS_ARCHIVE_FILE="playwright-browsers.tar.gz"
BROWSERS_CACHE_PATH="s3/$CACHE_BUCKET/$DRONE_REPO/browsers-cache/$playwright_version"

install_browsers() {
    echo "[INFO] Installing browsers..."
    pnpm exec playwright install --with-deps
    echo "[INFO] Archiving browsers..."
    tar -czf $BROWSERS_ARCHIVE_FILE .playwright
}

upload_browsers_cache() {
    echo "[INFO] Uploading browsers cache..."
    $MC_CMD cp -a $BROWSERS_ARCHIVE_FILE "$BROWSERS_CACHE_PATH"
}

restore_browsers_cache() {
    echo "[INFO] Restoring browsers cache..."
    $MC_CMD cp -a "$BROWSERS_CACHE_PATH/$BROWSERS_ARCHIVE_FILE" .
    tar -xf $BROWSERS_ARCHIVE_FILE -C .
}

check_browsers_cache() {
    local no_cache

    no_cache=$($MC_CMD find "$BROWSERS_CACHE_PATH/$BROWSERS_ARCHIVE_FILE" 2>&1 | grep 'Object does not exist')

    echo "cache: $no_cache ..."
    if [[ "$no_cache" ]]; then
        echo "not found"
    else
        echo "found"
    fi
    exit 0
}
check_browsers_cache
# cache_found=$(check_browsers_cache)
# if [[ "$cache_found" == "found" ]]; then
#     restore_browsers_cache
# else
#     install_browsers
#     upload_browsers_cache
# fi
