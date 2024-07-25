
FROM owncloudops/nginx@sha256:479684e60dea289c8e9688bef8b32ec1954aeffb25034685c78dd7ea74842978

LABEL maintainer="ownCloud GmbH <devops@owncloud.com>" \
  org.opencontainers.image.title="ownCloud Web Extensions" \
  org.opencontainers.image.vendor="ownCloud GmbH" \
  org.opencontainers.image.authors="ownCloud GmbH" \
  org.opencontainers.image.description="ownCloud Web Extensions" \
  org.opencontainers.image.documentation="https://github.com/owncloud/web-extensions" \
  org.opencontainers.image.url="https://hub.docker.com/r/owncloud/web-extensions" \
  org.opencontainers.image.source="https://github.com/owncloud/web-extensions"

RUN rm -f /var/lib/nginx/html/*

ADD docker/overlay /
ADD assets/ /var/lib/nginx/html
RUN find /var/lib/nginx/html

EXPOSE 8080

USER nginx

STOPSIGNAL SIGTERM

CMD ["nginx", "-g", "daemon off;"]
WORKDIR /var/lib/nginx/html
