
FROM owncloudops/nginx@sha256:24563623d6fe925ce033f09491d12e2b1d905984b247305b2166faa7f995d462

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
