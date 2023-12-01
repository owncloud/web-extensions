OC_CI_NODEJS = "owncloudci/nodejs:18"
OC_CI_BAZEL_BUILDIFIER = "owncloudci/bazel-buildifier"

PLUGINS_DOCKER = "plugins/docker:20.14"

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
        "steps": buildWeb(ctx) + buildDockerImage(ctx),
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
    }]

def buildDockerImage(ctx):
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

def buildWeb(ctx):
    return installPnpm() + \
           webLint() + \
           appBuild(ctx, "cast")

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
        "commands": [
            "pnpm lint",
        ],
    }]

def webTypecheck():
    return [{
        "name": "typecheck",
        "image": OC_CI_NODEJS,
        "commands": [
            "pnpm check:types",
        ],
    }]

def appBuild(ctx, name):
    return [{
        "name": "build-%s" % name,
        "image": OC_CI_NODEJS,
        "commands": [
            "cd 'packages/web-app-%s'" % name,
            "pnpm build",
            "mkdir -p ../../assets",
            "mv dist ../../assets/%s" % name,
        ],
    }]

def beforePipelines(ctx):
    return checkStarlark()

def stagePipelines(ctx):
    return []

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
