# Release Workflow for Web Extensions

This guide explains how to release multiple app versions in the web-extensions monorepo using the multi-tag approach.

   * [Overview](#overview)
   * [Step-by-Step Release Process](#step-by-step-release-process)
      * [1. Create a Feature Branch for Version Bumps](#1-create-a-feature-branch-for-version-bumps)
      * [2. Update Package Versions](#2-update-package-versions)
      * [3. Commit and Push the Changes](#3-commit-and-push-the-changes)
      * [4. Create a Pull Request](#4-create-a-pull-request)
      * [5. Get the Merge Commit Hash](#5-get-the-merge-commit-hash)
      * [6. Create Tags on the Merge Commit](#6-create-tags-on-the-merge-commit)
      * [7. Push Tags to Trigger CI](#7-push-tags-to-trigger-ci)
      * [8. Monitor CI Builds](#8-monitor-ci-builds)
      * [9. Verify Releases](#9-verify-releases)
   * [Technical Details](#technical-details)
      * [Tag Naming Convention](#tag-naming-convention)
   * [Troubleshooting](#troubleshooting)
      * [Wrong Commit Tagged](#wrong-commit-tagged)
   * [Quick Reference](#quick-reference)
   * [Files Modified in Each Release](#files-modified-in-each-release)
   * [Docker Hub](#docker-hub)

<!-- Created by https://github.com/ekalinin/github-markdown-toc -->

## Overview

The web-extensions repository uses a **per-app versioning** system where:

- Each app has its own independent version
- Multiple apps can be released from a single commit
- One merge commit on `main` can have multiple tags (one per app)
- Each tag triggers a separate CI pipeline for building and releasing that app

## Step-by-Step Release Process

### 1. Create a Feature Branch for Version Bumps

```bash
git checkout main
git pull origin main
git checkout -b chore/bump-versions
```

### 2. Update Package Versions

For each app that needs a version bump, update the `version` field in its `package.json`:

```bash
# Example: Updating cast app from 0.3.2 to 0.3.3
packages/web-app-cast/package.json
# Change: "version": "0.3.2" → "version": "0.3.3"

# Example: Updating unzip app from 0.4.2 to 0.4.3
packages/web-app-unzip/package.json
# Change: "version": "0.4.2" → "version": "0.4.3"

# ... repeat for other apps that need updates
```

**Apps in this Repository:**

- `packages/web-app-cast/`
- `packages/web-app-draw-io/`
- `packages/web-app-external-sites/`
- `packages/web-app-importer/`
- `packages/web-app-json-viewer/`
- `packages/web-app-progress-bars/`
- `packages/web-app-unzip/`

### 3. Commit and Push the Changes

```bash
git add packages/*/package.json
git commit -m "chore: bump versions"
git push origin chore/bump-versions
```

### 4. Create a Pull Request

Create a PR from your `chore/bump-versions` branch to `main` on GitHub.

Wait for approval and merge the PR. This creates a **merge commit** on `main`.

### 5. Get the Merge Commit Hash

After the PR is merged, get the commit hash of the merge commit:

```bash
git checkout main
git pull origin main
git log --oneline | head -5
# Example output:
# 2524913 Merge pull request #318 from owncloud/chore/bump-versions
# abda7bb [tx] updated from transifex
```

The commit hash is `2524913` in this example.

### 6. Create Tags on the Merge Commit

Create one tag per app that was bumped, all pointing to the **same** merge commit:

```bash
# Create tags for each app (use the version you set in step 2)
git tag cast-v0.3.3 2524913
git tag draw-io-v0.3.3 2524913
git tag external-sites-v0.3.3 2524913
git tag importer-v0.3.2 2524913
git tag json-viewer-v0.3.3 2524913
git tag progress-bars-v0.3.3 2524913
git tag unzip-v0.4.3 2524913
```

### 7. Push Tags to Trigger CI

You can push **all tags at once** with:

```bash
git push origin --tags
```

If CI does not trigger for all tags, re-push each tag **individually** to ensure Drone CI webhooks trigger properly:

```bash
git push origin --delete cast-v0.3.3 && git push origin cast-v0.3.3
git push origin --delete draw-io-v0.3.3 && git push origin draw-io-v0.3.3
git push origin --delete external-sites-v0.3.3 && git push origin external-sites-v0.3.3
git push origin --delete importer-v0.3.2 && git push origin importer-v0.3.2
git push origin --delete json-viewer-v0.3.3 && git push origin json-viewer-v0.3.3
git push origin --delete progress-bars-v0.3.3 && git push origin progress-bars-v0.3.3
git push origin --delete unzip-v0.4.3 && git push origin unzip-v0.4.3
```

**Why delete and re-push?** The first `git push --tags` may not trigger all webhooks reliably. Deleting and re-pushing each tag ensures each one individually triggers the Drone CI webhook.

### 8. Monitor CI Builds

Watch the builds on Drone CI:

- **Drone Dashboard**: https://drone.owncloud.com/owncloud/web-extensions

Each tag push triggers a separate build that:

1. Detects the tag (e.g., `draw-io-v0.3.3`)
2. Extracts the app name (`draw-io`) and version (`0.3.3`)
3. Builds that specific app
4. Creates a `.zip` artifact
5. Creates a GitHub release
6. Uploads the artifact to the release
7. Builds and pushes a Docker image

### 9. Verify Releases

Once builds complete, check:

- **GitHub Releases**: https://github.com/owncloud/web-extensions/releases
- **GitHub Tags**: https://github.com/owncloud/web-extensions/tags
- **Docker Hub**: https://hub.docker.com/r/owncloud/web-extensions

## Technical Details

### Tag Naming Convention

Tags follow the pattern: `{app-name}-v{version}`

Examples:

- `cast-v0.3.3`
- `draw-io-v0.3.3`
- `unzip-v0.4.3`

## Troubleshooting

### Wrong Commit Tagged

If you tagged the wrong commit:

1. Delete local and remote tags:

   ```bash
   git tag -d cast-v0.3.3
   git push origin --delete cast-v0.3.3
   ```

2. Create tags on the correct commit:
   ```bash
   git tag cast-v0.3.3 2524913
   git push origin cast-v0.3.3
   ```

## Quick Reference

```bash
# 1. Create and switch to feature branch
git checkout -b chore/bump-versions

# 2. Update package.json versions

# 3. Commit and push
git add packages/*/package.json
git commit -m "chore: bump versions"
git push origin chore/bump-versions

# 4. Merge PR to main

# 5. Get merge commit hash and create tags
COMMIT=$(git log origin/main --oneline -1 | awk '{print $1}')
git tag app1-vX.Y.Z $COMMIT
git tag app2-vX.Y.Z $COMMIT
# ... etc for all apps

# 6. Push tags one by one
git push origin --delete app1-vX.Y.Z && git push origin app1-vX.Y.Z
git push origin --delete app2-vX.Y.Z && git push origin app2-vX.Y.Z
# ... etc

# 7. Monitor on Drone and GitHub
```

## Files Modified in Each Release

When you create a release, these files are updated:

- `packages/web-app-{name}/package.json` - Version number

The CI/CD pipeline automatically:

- Builds the apps
- Creates GitHub releases with `.zip` artifacts
- Builds Docker images

You do **not** need to manually:

- Create GitHub releases (done by `.drone.star`)
- Build `.zip` files (done by Drone)
- Upload artifacts (done by Drone)


## Docker Hub

After successfully creating a new version, the relevant app image is made downloadable on [Docker Hub](https://hub.docker.com/r/owncloud/web-extensions/tags).
