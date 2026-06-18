# Web Extensions

<!-- OSPO-managed README | Generated: 2026-04-16 | v2 -->

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) [![ownCloud OSPO](https://img.shields.io/badge/OSPO-ownCloud-blue)](https://kiteworks.com/opensource) [![Docker Hub](https://img.shields.io/docker/pulls/owncloud)](https://hub.docker.com/r/owncloud/web-extensions)

Web Extensions is a collection of community and supplementary extensions for the ownCloud Web frontend that, for various reasons, are maintained outside of the main web repository. It includes extensions for draw.io integration, JSON file viewing, file casting, advanced search, photo enhancements, file importing, progress bars, external sites embedding and file unzipping -- each deployable as a standalone web app within oCIS.

## Part of oCIS

This repository is part of the [ownCloud Infinite Scale (oCIS)](https://github.com/owncloud/ocis) ecosystem. The extensions integrate with the [ownCloud Web](https://github.com/owncloud/web) frontend and can be individually enabled in oCIS deployments.

Web Extensions are available on [Docker Hub](https://hub.docker.com/r/owncloud/web-extensions).

### Included Extensions

- [web-app-advanced-search](packages/web-app-advanced-search/) -- Advanced search capabilities
- [web-app-ai-doc-summary](packages/web-app-ai-doc-summary/) -- AI-generated document summaries
- [web-app-cast](packages/web-app-cast/) -- Cast files to external devices
- [web-app-chat-with-file](packages/web-app-chat-with-file/) -- AI chat about file content
- [web-app-draw-io](packages/web-app-draw-io/) -- Draw.io diagram integration
- [web-app-external-sites](packages/web-app-external-sites/) -- Embed external websites
- [web-app-file-comments](packages/web-app-file-comments/) -- Markdown comments attached to files and folders
- [web-app-importer](packages/web-app-importer/) -- File import functionality
- [web-app-json-viewer](packages/web-app-json-viewer/) -- JSON file viewer
- [web-app-photo-addon](packages/web-app-photo-addon/) -- Photo enhancement features
- [web-app-progress-bars](packages/web-app-progress-bars/) -- Upload/download progress bars
- [web-app-unzip](packages/web-app-unzip/) -- ZIP file extraction
- [web-app-version-changelog](packages/web-app-version-changelog/) -- AI-generated changelog summaries for file version history

## Getting Started

Follow the steps below to install and develop extensions.

### Installation (oCIS Deployment Example)

Extensions can be enabled in the [ocis_full deployment example](https://github.com/owncloud/ocis/tree/master/deployments/examples/ocis_full) with minimal configuration. See the [admin docs](https://doc.owncloud.com/ocis/next/depl-examples/ubuntu-compose/ubuntu-compose-prod.html) for detailed instructions.

### Manual Installation

Refer to the [Web app docs](https://owncloud.dev/services/web/#loading-applications) to learn how to install apps in oCIS.

### Development

For developing new extensions or maintaining existing ones, see the [Starting Guide](docs/starting_guide.md).

```bash
pnpm install               # Install dependencies
pnpm build                 # Build all extensions
```

## Documentation

- [Starting Guide](docs/starting_guide.md)
- [Release Workflow](docs/RELEASE_WORKFLOW.md)
- [ownCloud Web Extension System](https://owncloud.dev/clients/web/extension-system/)
- [Loading Applications in oCIS](https://owncloud.dev/services/web/#loading-applications)

## Community & Support

**[Star](https://github.com/owncloud/web-extensions)** this repo and **Watch** for release notifications!

- [ownCloud Website](https://owncloud.com)
- [Community Discussions](https://github.com/orgs/owncloud/discussions)
- [Matrix Chat](https://app.element.io/#/room/#owncloud:matrix.org)
- [Documentation](https://doc.owncloud.com)
- [Enterprise Support](https://owncloud.com/contact-us/)
- [OSPO Home](https://kiteworks.com/opensource)

## Contributing

We welcome contributions! Please read the [Contributing Guidelines](CONTRIBUTING.md)
and our [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

### Workflow

- **Rebase Early, Rebase Often!** We use a rebase workflow. Always rebase on the target branch before submitting a PR.
- **Dependabot**: Automated dependency updates are managed via Dependabot. Review and merge dependency PRs promptly.
- **Signed Commits**: All commits **must** be PGP/GPG signed. See [GitHub's signing guide](https://docs.github.com/en/authentication/managing-commit-signature-verification).
- **DCO Sign-off**: Every commit must carry a `Signed-off-by` line:
  ```
  git commit -s -S -m "your commit message"
  ```
- **GitHub Actions Policy**: Workflows may only use actions that are (a) owned by `owncloud`, (b) created by GitHub (`actions/*`), or (c) verified in the GitHub Marketplace.

## Translations

Help translate this project on Transifex:
**<https://explore.transifex.com/owncloud-org/owncloud-web/>**

Please submit translations via Transifex -- do not open pull requests for translation changes.

## Security

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities at **<https://security.owncloud.com>** -- see [SECURITY.md](SECURITY.md).

Bug bounty: [YesWeHack ownCloud Program](https://yeswehack.com/programs/owncloud-bug-bounty-program)

## License

This project is licensed under the [AGPL-3.0](LICENSE).

## About the ownCloud OSPO

The [Kiteworks Open Source Program Office](https://kiteworks.com/opensource), operating under
the [ownCloud](https://owncloud.com) brand, launched on May 5, 2026, to steward the open source
ecosystem around ownCloud's products. The OSPO ensures transparent governance, license compliance,
community health, and sustainable collaboration between the open source community and
[Kiteworks](https://www.kiteworks.com), which acquired ownCloud in 2023.

- **OSPO Home**: <https://kiteworks.com/opensource>
- **GitHub**: <https://github.com/owncloud>
- **ownCloud**: <https://owncloud.com>

For questions about the OSPO or licensing, contact ospo@kiteworks.com.

### License Migration to Apache 2.0

The OSPO is driving a strategic relicensing of ownCloud repositories toward the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), following
the [Apache Software Foundation's third-party license policy](https://www.apache.org/legal/resolved.html).

Individual repositories will migrate as their audit is completed. The LICENSE file
in each repo reflects its **current** license status (not the target).

**Current license: AGPL-3.0** (Category X per Apache policy -- cannot be included in Apache-2.0 works).

Migration prerequisites for this repository:

- **CLA/DCO coverage**: All past contributors must have signed agreements permitting relicensing
- **Copyleft dependency audit**: All AGPL/GPL dependencies must be replaced or isolated
- **KDE heritage review**: Any code with KDE-era copyrights requires legal analysis
- **Complete relicensing**: AGPL-3.0 is a strong copyleft license; migration requires full relicensing of all files, not just a header change
