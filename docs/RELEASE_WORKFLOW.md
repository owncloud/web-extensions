# Release Workflow for Web Extensions

This guide explains how to release multiple app versions in the web-extensions monorepo using the multi-tag approach.

   * [Overview](#overview)
   * [Step-by-Step Release Process](#step-by-step-release-process)
      * [1. Create a Feature Branch for Version Bumps](#1-create-a-feature-branch-for-version-bumps)
      * [2. Update Package Versions](#2-update-package-versions)
      * [3. Commit and Push the Changes](#3-commit-and-push-the-changes)
      * [4. Create a Pull Request](#4-create-a-pull-request)
      * [5. Get the Merge Commit Hash](#5-get-the-merge-commit-hash)
      * [6. Create and Push Tags on the Merge Commit](#6-create-and-push-tags-on-the-merge-commit)
      * [7. Monitor CI Builds](#7-monitor-ci-builds)
      * [8. Verify Releases](#8-verify-releases)
      * [9. Deployment Examples](#9-deployment-examples)
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
- Tags need to be signed when created

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
# Example: Updating cast app from 0.3.3 to 0.4.0
packages/web-app-cast/package.json
# Change: "version": "0.3.3" → "version": "0.4.0"

# Example: Updating unzip app from 0.4.3 to 0.5.0
packages/web-app-unzip/package.json
# Change: "version": "0.4.3" → "version": "0.5.0"

# ... repeat for other apps that need updates
```

**Apps in this Repository:**

- `packages/web-app-advanced-search/`
- `packages/web-app-cast/`
- `packages/web-app-draw-io/`
- `packages/web-app-external-sites/`
- `packages/web-app-importer/`
- `packages/web-app-json-viewer/`
- `packages/web-app-photo-addon/`
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

### 6. Create and Push Tags on the Merge Commit

Note that it would be possible to tag all web-extensions and push them in one step, but it has turned out that this will not trigger the release workflow. You therefore have to tag and push web-extensions individually which is proven to work.

When the tag is created, you will be asked to add a comment. As a rule of thumb, use as example:\t
`feat: advanced-search-v0.3.0`
 
Create a tag of the app that was bumped, pointing to the **exact** merge commit from above:

```bash
# Create tags for each app (use the version you set in step 2)
git tag -s advanced-search-v0.3.0 2524913
git push origin --tags

git tag -s cast-v0.4.3 2524913
git push origin --tags

git tag -s draw-io-v0.4.0 2524913
git push origin --tags

git tag -s external-sites-v0.4.0 2524913
git push origin --tags

git tag -s importer-v0.4.0 2524913
git push origin --tags

git tag -s json-viewer-v0.4.0 2524913
git push origin --tags

git tag -s photo-addon-v0.3.0 2524913
git push origin --tags

git tag -s progress-bars-v0.4.0 2524913
git push origin --tags

git tag -s unzip-v0.5.0 2524913
git push origin --tags
```

### 7. Monitor CI Builds

Watch the builds on GitHub Actions:

- **GitHub Actions**: https://github.com/owncloud/web-extensions/actions

Each tag push triggers a separate build that:

1. Detects the tag (e.g., `draw-io-v0.4.0`)
2. Extracts the app name (`draw-io`) and version (`0.4.0`)
3. Builds that specific app
4. Creates a `.zip` artifact
5. Creates a GitHub release
6. Uploads the artifact to the release
7. Builds and pushes a Docker image

### 8. Verify Releases

Once builds complete, check:

- **GitHub Releases**: https://github.com/owncloud/web-extensions/releases
- **GitHub Tags**: https://github.com/owncloud/web-extensions/tags
- **Docker Hub**: https://hub.docker.com/r/owncloud/web-extensions

### 9. Deployment Examples

You can now update the image versions of the [ocis_full](https://github.com/owncloud/ocis/tree/master/deployments/examples/ocis_full/web_extensions) deployment examples.

## Technical Details

### Tag Naming Convention

Tags follow the pattern: `{app-name}-v{version}`

Examples:

- `cast-v0.4.0`
- `draw-io-v0.4.0`
- `unzip-v0.4.0`

## Troubleshooting

### Wrong Commit Tagged

If you tagged the wrong commit:

1. Delete local and remote tags:

   ```bash
   git tag -d cast-v0.4.0
   git push origin --delete cast-v0.4.0
   ```

2. Create tags on the correct commit:
   ```bash
   git tag -s cast-v0.4.0 2524913
   git push origin cast-v0.4.0
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
git tag -s app1-vX.Y.Z $COMMIT
git tag -s app2-vX.Y.Z $COMMIT
# ... etc for all apps

# 6. Push tags one by one
git push origin --delete app1-vX.Y.Z && git push origin app1-vX.Y.Z
git push origin --delete app2-vX.Y.Z && git push origin app2-vX.Y.Z
# ... etc

# 7. Monitor on GitHub Actions
```

## Files Modified in Each Release

When you create a release, these files are updated:

- `packages/web-app-{name}/package.json` - Version number

The CI/CD pipeline automatically:

- Builds the apps
- Creates GitHub releases with `.zip` artifacts
- Builds Docker images

You do **not** need to manually:

- Create GitHub releases (done by GHA)
- Build `.zip` files (done by GHA)
- Upload artifacts (done by GHA)


## Docker Hub

After successfully creating a new version, the relevant app image is made downloadable on [Docker Hub](https://hub.docker.com/r/owncloud/web-extensions/tags).
