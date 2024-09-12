FROM owncloudops/nginx@sha256:8ca0c90c2f537fef6195ba8f5ebe6d6c00fe0a0c545f25ce8acd418a831a19a4

LABEL maintainer="ownCloud GmbH <devops@owncloud.com>" \
  org.opencontainers.image.title="ownCloud Web Extensions" \
  org.opencontainers.image.description="ownCloud Web Extensions" \
  org.opencontainers.image.vendor="ownCloud GmbH" \
  org.opencontainers.image.authors="ownCloud GmbH" \
  org.opencontainers.image.licenses="AGPL-3.0" \
  org.opencontainers.image.documentation="https://github.com/owncloud/web-extensions" \
  org.opencontainers.image.url="https://hub.docker.com/r/owncloud/web-extensions" \
  org.opencontainers.image.source="https://github.com/owncloud/web-extensions"

ARG app_path
ARG app_name

RUN rm -f /var/lib/nginx/html/*

ADD $app_path /var/lib/nginx/html/$app_name
RUN find /var/lib/nginx/html

EXPOSE 8080

USER nginx

STOPSIGNAL SIGTERM

CMD ["nginx", "-g", "daemon off;"]
WORKDIR /var/lib/nginx/html