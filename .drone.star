OC_CI_NODEJS = "owncloudci/nodejs:18"
OC_CI_BAZEL_BUILDIFIER = "owncloudci/bazel-buildifier"
OC_CI_ALPINE = "owncloudci/alpine:latest"

PLUGINS_DOCKER = "plugins/docker:20.14"
PLUGINS_GITHUB_RELEASE = "plugins/github-release:1"

WEB_EXTENSIONS_PUBLISH_PACKAGES = ["cast", "progress-bars"]

PACKAGES_WITH_UNIT_TESTS = [
    "web-app-draw-io",
]

def main(ctx):
    before = beforePipelines(ctx)

    stages = pipelinesDependsOn(stagePipelines(ctx), before)
    if (stages == False):
        print("Errors detected. Review messages above.")
        return []

    after = pipelinesDependsOn(afterPipelines(ctx), stages)

    pipelines = before + stages + after

    return pipelines

def build(ctx):
    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "build",
        "steps": buildWeb(ctx) + buildDockerImage(ctx) + buildRelease(ctx),
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
    }]

def determineReleasePackage(ctx):
    if ctx.build.event != "tag":
        return None

    matches = [p for p in WEB_EXTENSIONS_PUBLISH_PACKAGES if ctx.build.ref.startswith("refs/tags/%s-v" % p)]
    if len(matches) > 0:
        return matches[0]

    return None

def determineReleaseVersion(ctx):
    package = determineReleasePackage(ctx)
    if package == None:
        return ctx.build.ref.replace("refs/tags/v", "")

    return ctx.build.ref.replace("refs/tags/" + package + "-v", "")

def buildDockerImage(ctx):
    package = determineReleasePackage(ctx)
    if package != "":
        return []

    return [
        {
            "name": "docker-dry-run",
            "image": PLUGINS_DOCKER,
            "settings": {
                "dry_run": "true",
                "dockerfile": "docker/Dockerfile",
                "repo": "owncloud/web-extensions",
            },
            "when": {
                "ref": [
                    "refs/pull/**",
                ],
            },
        },
        {
            "name": "docker",
            "image": PLUGINS_DOCKER,
            "settings": {
                "username": {
                    "from_secret": "docker_username",
                },
                "password": {
                    "from_secret": "docker_password",
                },
                "auto_tag": True,
                "dockerfile": "docker/Dockerfile",
                "repo": "owncloud/web-extensions",
            },
            "when": {
                "ref": {
                    "exclude": [
                        "refs/pull/**",
                    ],
                },
            },
        },
    ]

def buildRelease(ctx):
    package = determineReleasePackage(ctx)
    version = determineReleaseVersion(ctx)
    if package == None:
        return []

    return [
        {
            "name": "package",
            "image": OC_CI_ALPINE,
            "depends_on": ["build-%s" % package],
            "commands": [
                "apk add zip",
                "cd assets/extensions",
                "zip -r ../../%s-%s.zip %s/" % (package, version, package),
            ],
            "when": {
                "ref": [
                    "refs/tags/**",
                ],
            },
        },
        {
            "name": "publish",
            "image": PLUGINS_GITHUB_RELEASE,
            "depends_on": ["package"],
            "settings": {
                "api_key": {
                    "from_secret": "github_token",
                },
                "files": [
                    "%s-%s.zip" % (package, version),
                ],
                "checksum": [
                    "md5",
                    "sha256",
                ],
                "title": "%s %s" % (package, version),
                "note": ".release_note",
                "overwrite": True,
            },
            "when": {
                "ref": [
                    "refs/tags/**",
                ],
            },
        },
    ]

def buildWeb(ctx):
    return installPnpm() + \
           appBuild(ctx, "cast") + \
           appBuild(ctx, "draw-io") + \
           appBuild(ctx, "external-sites") + \
           appBuild(ctx, "progress-bars")

def installPnpm():
    return [{
        "name": "pnpm-install",
        "image": OC_CI_NODEJS,
        "commands": [
            'npm install --silent --global --force "$(jq -r ".packageManager" < package.json)"',
            "pnpm config set store-dir ./.pnpm-store",
            "pnpm install",
        ],
    }]

def webLint():
    return [{
        "name": "lint",
        "image": OC_CI_NODEJS,
        "depends_on": ["pnpm-install"],
        "commands": [
            "pnpm lint",
        ],
    }]

def webTypecheck():
    return [{
        "name": "typecheck",
        "image": OC_CI_NODEJS,
        "depends_on": ["pnpm-install"],
        "commands": [
            "pnpm check:types",
        ],
    }]

def appBuild(ctx, name):
    return [{
        "name": "build-%s" % name,
        "image": OC_CI_NODEJS,
        "depends_on": ["pnpm-install"],
        "commands": [
            "cd 'packages/web-app-%s'" % name,
            "pnpm build",
            "mkdir -p ../../assets/extensions",
            "mv dist ../../assets/extensions/%s" % name,
        ],
    }]

def beforePipelines(ctx):
    return checkStarlark()

def stagePipelines(ctx):
    return checks(ctx) + unitTests(ctx)

def afterPipelines(ctx):
    return build(ctx)

def pipelineDependsOn(pipeline, dependant_pipelines):
    if "depends_on" in pipeline.keys():
        pipeline["depends_on"] = pipeline["depends_on"] + getPipelineNames(dependant_pipelines)
    else:
        pipeline["depends_on"] = getPipelineNames(dependant_pipelines)
    return pipeline

def pipelinesDependsOn(pipelines, dependant_pipelines):
    pipes = []
    for pipeline in pipelines:
        pipes.append(pipelineDependsOn(pipeline, dependant_pipelines))

    return pipes

def getPipelineNames(pipelines = []):
    """getPipelineNames returns names of pipelines as a string array

    Args:
      pipelines: array of drone pipelines

    Returns:
      names of the given pipelines as string array
    """
    names = []
    for pipeline in pipelines:
        names.append(pipeline["name"])
    return names

def checkStarlark():
    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "check-starlark",
        "steps": [
            {
                "name": "format-check-starlark",
                "image": OC_CI_BAZEL_BUILDIFIER,
                "commands": [
                    "buildifier --mode=check .drone.star",
                ],
            },
            {
                "name": "show-diff",
                "image": OC_CI_BAZEL_BUILDIFIER,
                "commands": [
                    "buildifier --mode=fix .drone.star",
                    "git diff",
                ],
                "when": {
                    "status": [
                        "failure",
                    ],
                },
            },
        ],
        "trigger": {
            "ref": [
                "refs/pull/**",
            ],
        },
    }]

def checks(ctx):
    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "lint+types",
        "steps": installPnpm() +
                 webLint() +
                 webTypecheck(),
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
    }]

def unitTests(ctx):
    unitTestPipelines = []

    for package in PACKAGES_WITH_UNIT_TESTS:
        unitTestPipelines.append({
            "name": package,
            "image": OC_CI_NODEJS,
            "depends_on": ["pnpm-install"],
            "commands": [
                "cd packages/%s" % package,
                "pnpm test:unit",
            ],
        })

    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "unit-tests",
        "steps": installPnpm() + unitTestPipelines,
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
    }]
