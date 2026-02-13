# web-extensions

[![Matrix](https://img.shields.io/matrix/ocis%3Amatrix.org?logo=matrix)](https://app.element.io/#/room/#ocis:matrix.org)
[![Build Status](https://drone.owncloud.com/api/badges/owncloud/web-extensions/status.svg)](https://drone.owncloud.com/owncloud/web-extensions)
[![web-extensions docker image](https://img.shields.io/docker/v/owncloud/web-extensions?label=web-extensions&logo=docker&sort=semver)](https://hub.docker.com/r/owncloud/web-extensions)
[![License](https://img.shields.io/badge/License-AGPL%203-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

This repository contains a collection of [ownCloud Web](https://github.com/owncloud/web) extensions that, for various reasons, have not been added to the main repository.

   * [Existing Web-Extensions](#existing-web-extensions)
   * [Installing Apps in oCIS](#installing-apps-in-ocis)
   * [Adding a New App to This Repository](#adding-a-new-app-to-this-repository)
   * [Release Workflow for Web Extensions](#release-workflow-for-web-extensions)

<!-- Created by https://github.com/ekalinin/github-markdown-toc -->

## Existing Web-Extensions

The following extension examples are provided to be used with the Infinite Scale web frontend.

- [web-app-cast](./packages/web-app-cast/)
- [web-app-draw-io](./packages/web-app-draw-io/)
- [web-app-external-sites](./packages/web-app-external-sites/)
- [web-app-importer](./packages/web-app-importer/)
- [web-app-json-viewer](./packages/web-app-json-viewer/)
- [web-app-progress-bars](./packages/web-app-progress-bars/)
- [web-app-unzip](./packages/web-app-unzip/)

## Installing Apps in oCIS

There are two ways installing these extension examples:

* You can enable the web apps in our deployment example with minimal effort.\
  To see how this gets implemented, see the [ocis_full](https://github.com/owncloud/ocis/tree/master/deployments/examples/ocis_full) deployment example.\
  For a detailed installation instruction using `ocis_full` see the [admin docs, Local Production Setup](https://doc.owncloud.com/ocis/next/depl-examples/ubuntu-compose/ubuntu-compose-prod.html).\
  (Before you start, select the ocis version in the admin docs you want to use this example for.)
* On a general level, refer to the [Web app docs](https://owncloud.dev/services/web/#loading-applications) to learn how to install apps in oCIS.

## Adding a New App to This Repository

To start developing a new web-extension or maintaining an existing one, see the [Starting Guide](docs/starting_guide.md) fdor more details.

## Release Workflow for Web Extensions

If required, an own document guides you through processing new releases of apps, such as when code changes have been made or dependencies have been updated. For more details see the [RELEASE_WORKFLOW](./docs/RELEASE_WORKFLOW.md) documentation.

