OC_CI_NODEJS = "owncloudci/nodejs:18"
OC_CI_BAZEL_BUILDIFIER = "owncloudci/bazel-buildifier"
OC_CI_ALPINE = "owncloudci/alpine:latest"
PLUGINS_S3 = "plugins/s3:1.4.0"
OC_UBUNTU = "owncloud/ubuntu:20.04"

PLUGINS_DOCKER = "plugins/docker:20.14"
PLUGINS_GITHUB_RELEASE = "plugins/github-release:1"

APPS = [
    "cast",
    "draw-io",
    "external-sites",
    "importer",
    "json-viewer",
    "progress-bars",
    "unzip",
]

E2E_COVERED_APPS = [
    "draw-io",
    "unzip",
    "progress-bars",
    "json-viewer",
    "external-sites",
]

OCIS_URL = "https://ocis:9200"

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
    return checks(ctx) + unitTests(ctx) + e2eTests(ctx)

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
                "apps/%s-%s.zip" % (app, version),
            ],
            "checksum": [
                "md5",
                "sha256",
            ],
            "title": "%s %s" % (app, version),
            "note": """%s-%s

              ## How to use
              Download the attached release artifact "%s-%s.zip" and extract it to your oCIS apps folder.
              Please refer to [our documentation](https://owncloud.dev/services/web/#loading-applications) for more information.""" % (app, version, app, version),
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
        "depends_on": ["build-%s" % app],
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
                "app_path=./apps/%s" % app,
                "app_name=%s" % app,
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
                "mkdir -p ../../apps",
                "mv dist ../../apps/%s" % app,
            ],
        })

        app_build_steps.append({
            "name": "package-%s" % app,
            "image": OC_CI_ALPINE,
            "depends_on": ["build-%s" % app],
            "commands": [
                "apk add zip",
                "cd apps",
                "zip -r %s-%s.zip %s/" % (app, release_version, app),
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

def ocisService():
    environment = {
        "OCIS_URL": OCIS_URL,
        "OCIS_INSECURE": "true",
        "OCIS_LOG_LEVEL": "error",
        "IDM_ADMIN_PASSWORD": "admin",
        "PROXY_ENABLE_BASIC_AUTH": True,
        "WEB_ASSET_APPS_PATH": "/apps",
        "WEB_UI_CONFIG_FILE": "/drone/src/support/drone/ocis.web.config.json",
        "PROXY_CSP_CONFIG_FILE_LOCATION": "/drone/src/dev/docker/csp.yaml",
    }

    app_build_steps = [
        {
            "name": "build-web-apps",
            "image": OC_CI_NODEJS,
            "commands": [
                "pnpm build",
                "mkdir -p /apps",
                "mv packages/web-app-draw-io/dist /apps/draw-io",
                "mv packages/web-app-unzip/dist /apps/unzip",
                "mv packages/web-app-progress-bars/dist /apps/progress-bars",
                "mv packages/web-app-json-viewer/dist /apps/json-viewer",
                "mv packages/web-app-external-sites/dist /apps/web-app-external-sites",
                "cp packages/web-app-external-sites/tests/config/manifest.json /apps/web-app-external-sites/manifest.json",
            ],
            "volumes": [
                {
                    "name": "apps",
                    "path": "/apps",
                },
            ],
        },
    ]

    ocis_service = [
        {
            "name": "ocis",
            "image": "owncloud/ocis-rolling:master",
            "detach": True,
            "environment": environment,
            "commands": [
                "cp dev/docker/ocis.apps.yaml /var/lib/ocis/apps.yaml",
                "ocis init || true && ocis server",
            ],
            "volumes": [
                {
                    "name": "apps",
                    "path": "/apps",
                },
            ],
        },
    ]

    wait_for_ocis = [
        {
            "name": "wait-for-ocis",
            "image": OC_CI_ALPINE,
            "commands": [
                "timeout 200 bash -c 'while [ $(curl -sk -uadmin:admin " +
                "%s/graph/v1.0/users/admin " % OCIS_URL +
                "-w %{http_code} -o /dev/null) != 200 ]; do sleep 1; done'",
            ],
        },
    ]

    return app_build_steps + ocis_service + wait_for_ocis

def uploadTracingResult(ctx):
    return [{
        "name": "upload-tracing-result",
        "image": PLUGINS_S3,
        "pull": "if-not-exists",
        "settings": {
            "bucket": {
                "from_secret": "cache_public_s3_bucket",
            },
            "endpoint": {
                "from_secret": "cache_public_s3_server",
            },
            "path_style": True,
            "source": "test-results/**/*",
            "strip_prefix": "test-results",
            "target": "/${DRONE_REPO}/${DRONE_BUILD_NUMBER}/tracing",
        },
        "environment": {
            "AWS_ACCESS_KEY_ID": {
                "from_secret": "cache_public_s3_access_key",
            },
            "AWS_SECRET_ACCESS_KEY": {
                "from_secret": "cache_public_s3_secret_key",
            },
        },
        "when": {
            "status": ["failure"],
        },
    }]

def logTracingResult(ctx):
    return [{
        "name": "log-tracing-result",
        "image": OC_UBUNTU,
        "commands": [
            "cd test-results/",
            'echo "To see the trace, please open the following link in the console"',
            'for f in */; do echo "npx playwright show-trace https://cache.owncloud.com/public/${DRONE_REPO}/${DRONE_BUILD_NUMBER}/tracing/$f"trace.zip" \n"; done',
        ],
        "when": {
            "status": ["failure"],
        },
    }]

def e2eTests(ctx):
    e2e_test_steps = [{
        "name": "install-browser",
        "image": OC_CI_NODEJS,
        "commands": [
            "pnpm exec playwright install chromium",
        ],
        "volumes": [
            {
                "name": "playwright-cache",
                "path": "/root/.cache/ms-playwright",
            },
        ],
    }]
    for app in E2E_COVERED_APPS:
        e2e_test_steps.append({
            "name": app,
            "image": OC_CI_NODEJS,
            "commands": [
                "BASE_URL_OCIS=%s pnpm test:e2e --project='%s-chromium'" % (OCIS_URL, app),
            ],
            "volumes": [
                {
                    "name": "playwright-cache",
                    "path": "/root/.cache/ms-playwright",
                },
            ],
        })

    return [{
        "kind": "pipeline",
        "type": "docker",
        "name": "e2e-tests",
        "steps": installPnpm() + ocisService() + e2e_test_steps + uploadTracingResult(ctx) + logTracingResult(ctx),
        "trigger": {
            "ref": [
                "refs/heads/main",
                "refs/heads/stable-*",
                "refs/tags/**",
                "refs/pull/**",
            ],
        },
        "volumes": [
            {
                "name": "apps",
                "temp": {},
            },
            {
                "name": "playwright-cache",
                "temp": {},
            },
        ],
    }]
