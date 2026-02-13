# Starting Guide

This guide helps you to create new extensions. It highlights important prerequisites that should be considered to simplify the creation and review processes. Find us on [matrix](https://matrix.to/#/#ocis:matrix.org) to contact the developer team.

**Table of Contents**

   * [General Information](#general-information)
   * [Environmental Prerequisites](#environmental-prerequisites)
   * [Web-Extension Prerequisites](#web-extension-prerequisites)
   * [Linting and Typescript Checks](#linting-and-typescript-checks)
   * [Testing the App](#testing-the-app)
   * [ocis_full Deployment Example](#ocis_full-deployment-example)

<!-- Created by https://github.com/ekalinin/github-markdown-toc -->

## General Information

At the time of writing, CI runs have been disabled for pull requests originating from forks of this repository. This means that when forking the repository and creating pull requests (PRs), users with enhanced permissions must create their own branch and keep it in sync with the one from the fork. This will no longer be necessary once the web extension repository has been integrated into the web repository and then into the OCI repository. As additional commits may be made to the local branch, the fork must be updated accordingly to keep things in sync.

It is highly recommended that ownCloud developers add the fork/branch to their local repository. This makes it easier to keep the branches synchronised.

To create a mirror branch based on a remote and sync it, you need to perform the following tasks. Make sure the main branch is up to date and use it as the base.

```bash
git remote add -f <shortname> <url>
git checkout -b <shortname>/<remote-branch>
git checkout main
git checkout -b <your-local-branch>

git merge <remote-branch>
```

If the local branch becomes corrupted and needs to be reset, resynced or rebased due to merges with the main branch, run the following commands:

```bash
git checkout main
git pull --rebase origin/main
git checkout <your-local-branch>
git reset --hard origin/main
git merge <remote-branch>
```

## Environmental Prerequisites

To start creating a new web-extension, the contributor must have installed `git`, `docker`, `docker compose` and `pnpm`.

In addition, the `/etc/hosts` file needs to be extended by adding `127.0.1.1 host.docker.internal` which is required for testing the web-extension using the provided docker compose environment.

## Web-Extension Prerequisites

New web-extensions must be placed inside the `packages` folder and be prefixed with `web-app-`. Additionally, the following prerequisites are required:

- Add the new web-extension to the `APPS` variable in the `.drone.star` file.
- Add the `dist` folder of the web-extension to the list of volume mounts in the `docker-compose.yml` file in the `ocis` service section.
- If the web-extension requires additional external docker images, they must be added to the `docker-compose.yml` file.
- Add any changes to content security policies, if required, to `dev/docker/csp.yaml`.
- Follow the structure of files and folders of other web-extensions.
- Provide a README file for the web-extension.
- Use the actual stable tag of web In the `dependencies` and `devDependencies` section of the `package.json` file.\
  This tag must be updated on new ocis production releases, see the [RELEASE_WORKFLOW](./RELEASE_WORKFLOW.md) documentation.
- Post creating the `package.json` file or on changes, run from the repo-root `pnpm install`.\
  To avoid rare issues, delete the `pnpm-lock.json` file before running `pnpm install`.
- If texts are printed to the webUI:
  - Texts must be translatable. Use `l10n` and `gettext` to do so.
  - Use other web-extensions as template for the `l10n` folder.
  - On merge, the resource to translate is available on [Transifex](https://app.transifex.com/owncloud-org/owncloud-web/translate/#de).\
    Note that an account is required and you need to be promoted as translator for defined languages. You will not see the data otherwise.
- Web provides themes (light and dark). Check that the web-extension supports the themes.
- Provide tests

## Linting and Typescript Checks

During a CI run, a linter and typecheck is initiated. No other tests will be started if these do not pass.

For the linter, the following commonly reported issues can be avoided and fix cycles minimized:

- non-interactive elements should not have an interactive handler
- non-interactive elements with click handlers must have at least one keyboard listener
- warning 'xxx' is defined but never used
- warning Async function 'xxx' has no 'await' expression require-await
- warning Prop "xxx" should be optional
- 'a' should be before 'b'\
  Check the order of elements in vue files (eg: key then :aria-level than @click...)

## Testing the App

The web-extension repo uses a `docker-compose.yml` file that starts all services required for testing.\
To start testing, the web-extension must be built locally and the compose environment needs to be started.

```bash
cd <repo-root>
pnpm install --frozen-lockfile
pnpm build
docker compose up -d
```

In a browser, use as URL: `https://host.docker.internal:9200` and for the login `admin/admin`.
 
To stop the container run:
```bash
docker compose down --remove-orphans
```

To update used images other than the web-extension run:
```bash
docker compose pull
```

## ocis_full Deployment Example 

If a web-extension has been added or a new version been created, it is availabe as docker image on [Docker hub](https://hub.docker.com/r/owncloud/web-extensions). This image can then be used by ocis but must be added manually. To make the web-extension easily available to the public, the contributor can add it to the [ocis_full](https://github.com/owncloud/ocis/blob/master/deployments/examples/ocis_full) deployment example. This deployment example is maintained by the developers, regulary updated and checked, mentioned in the [release notes](https://doc.owncloud.com/ocis_release_notes.html) on changes and finally fully described in the [Admin Docs](https://doc.owncloud.com/ocis/next/depl-examples/ubuntu-compose/ubuntu-compose-prod.html).

The relevant locations for changes in the `ocis_full` deployment example are:

```
.env
web-extensions/
config/ocis/csp.yaml
```

If a web-extension has been merged or an updated has been made, the contributor can add or update the deployment example accordingly.

Note that if the web extension is added to the `ocis_full` deployment example, any changes relating to Docker Compose and csp must be transferred to the deployment example.
