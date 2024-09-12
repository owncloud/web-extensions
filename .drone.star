OC_CI_NODEJS = "owncloudci/nodejs:18"
OC_CI_BAZEL_BUILDIFIER = "owncloudci/bazel-buildifier"
OC_CI_ALPINE = "owncloudci/alpine:latest"

PLUGINS_DOCKER = "plugins/docker:20.14"
PLUGINS_GITHUB_RELEASE = "plugins/github-release:1"

APPS = [
    "cast",
    "draw-io",
    "external-sites",
    "json-viewer",
    "progress-bars",
    "unzip",
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

def determineReleaseApp(ctx):
    if ctx.build.event != "tag":
        return None

    matches = [p for p in APPS if ctx.build.ref.startswith("refs/tags/%s-v" % p)]
    if len(matches) > 0:
        return matches[0]

    return None

def determineReleaseVersion(ctx):
    app = determineReleaseApp(ctx)
    if app == None:
        return None

    return ctx.build.ref.replace("refs/tags/%s-v" % app, "")

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

def beforePipelines(ctx):
    return checkStarlark()

def stagePipelines(ctx):
    return checks(ctx) + unitTests(ctx)

def afterPipelines(ctx):
    return appBuilds(ctx)

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
    unit_test_steps = []

    for app in APPS:
        unit_test_steps.append({
            "name": app,
            "image": OC_CI_NODEJS,
            "depends_on": ["pnpm-install"],
            "commands": [
                "cd packages/web-app-%s" % app,
                "pnpm test:unit",
            ],
        })

    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "unit-tests",
        "steps": installPnpm() + unit_test_steps,
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
    }]

def publishSteps(ctx):
    app = determineReleaseApp(ctx)
    version = determineReleaseVersion(ctx)
    if app == None:
        return []

    return [{
        "name": "publish",
        "image": PLUGINS_GITHUB_RELEASE,
        "depends_on": ["package-%s" % app],
        "settings": {
            "api_key": {
                "from_secret": "github_token",
            },
            "files": [
                "%s-%s.zip" % (app, version),
            ],
            "checksum": [
                "md5",
                "sha256",
            ],
            "title": "%s %s" % (app, version),
            "note": ".release_note",
            "overwrite": True,
        },
        "when": {
            "ref": [
                "refs/tags/**",
            ],
        },
    }]

def dockerImageSteps(ctx):
    app = determineReleaseApp(ctx)
    version = determineReleaseVersion(ctx)
    if app == None:
        return []

    return [{
        "name": "docker",
        "image": PLUGINS_DOCKER,
        "depends_on": ["package-%s" % app],
        "settings": {
            "username": {
                "from_secret": "docker_username",
            },
            "password": {
                "from_secret": "docker_password",
            },
            "dockerfile": "docker/Dockerfile",
            "repo": "owncloud/web-extensions",
            "tags": [
                "%s-%s" % (app, version),
                "%s-latest" % app,
            ],
            "build_args": [
                "app_path=%s-%s.zip" % (app, version),
            ],
        },
        "when": {
            "ref": [
                "refs/tags/**",
            ],
        },
    }]

def appBuilds(ctx):
    release_app = determineReleaseApp(ctx)
    release_version = determineReleaseVersion(ctx)

    app_build_steps = []
    for app in APPS:
        if release_app != None and release_app != app:
            continue

        app_build_steps.append({
            "name": "build-%s" % app,
            "image": OC_CI_NODEJS,
            "depends_on": ["pnpm-install"],
            "commands": [
                "cd 'packages/web-app-%s'" % app,
                "pnpm build",
                "mkdir -p ../../assets/extensions",
                "mv dist ../../assets/extensions/%s" % app,
            ],
        })

        app_build_steps.append({
            "name": "package-%s" % app,
            "image": OC_CI_ALPINE,
            "depends_on": ["build-%s" % app],
            "commands": [
                "apk add zip",
                "cd assets/extensions",
                "zip -r ../../%s-%s.zip %s/" % (app, release_version, app),
            ],
            "when": {
                "ref": [
                    "refs/tags/**",
                ],
            },
        })

    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "build",
        "steps": installPnpm() + app_build_steps + publishSteps(ctx) + dockerImageSteps(ctx),
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
    }]
