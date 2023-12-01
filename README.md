# web-extensions

This repository contains a collection of [ownCloud Web](https://github.com/owncloud/web) extensions, which for different reasons are not added to the main repository.

## Apps

Extensions are provided by apps. These are the apps, that are provided by this repository.

## [web-app-cast](./packages/web-app-cast/)

This app enables Google Cast integration for ownCloud Web.

## Usage instructions

There is a docker image hosted on [Docker Hub](https://registry.hub.docker.com/r/owncloud/web-extensions).
It serves compiled assets statically.

This is the list of available app paths provided by the service:
```
/extensions/cast/cast.js
```

### ocis_traefik

If you want to deploy web-extensions to the [ocis_traefik]https://github.com/owncloud/ocis/tree/master/deployments/examples/ocis_traefik) example, you need to add a service like this to the `docker-compose.yml` file.

```yaml
   web-extensions:
     image: owncloud/web-extensions:latest
     networks:
       ocis-net:
     labels:
       - "traefik.enable=true"
       - "traefik.http.routers.web-extensions.entrypoints=https"
       - "traefik.http.routers.web-extensions.rule=Host(`${OCIS_DOMAIN:-ocis.owncloud.test}`) && PathPrefix(`/extensions`)"
       - "traefik.http.routers.web-extensions.tls.certresolver=http"
       - "traefik.http.routers.web-extensions.service=web-extensions"
       - "traefik.http.services.web-extensions.loadbalancer.server.port=8080"
```

You can verify this work correctly by checking `https://ocis.owncloud.test/extensions/cast/cast.js` is a minified javascript file.

Now you can create a `web.config.yaml` file in the `ocis_traefik` folder with the following content:

```yaml
web:
  config:
    external_apps:
      - id: cast
        path: https://ocis.owncloud.test/extensions/cast/cast.js
```

and mount that to your oCIS container by adding a volume to it like this:

```yaml
  ocis:
    [...]
    volumes:
      - ./web.config.yaml:/etc/ocis/web.yaml
      [...]
```

If something does not work as expected, you can try to run `docker-compose up --force-recreate` and check again.
