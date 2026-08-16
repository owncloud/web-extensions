# Builds https://github.com/livekit-examples/meet - LiveKit's official open
# source demo video-conferencing frontend. Upstream ships no Dockerfile/image,
# so this repo builds it from source, pinned to a specific commit for
# reproducibility.
FROM node:20-alpine

RUN apk add --no-cache git git-lfs

WORKDIR /app

ARG MEET_COMMIT=665e1cb7841ab872de0d8e5c310744009a763b08
RUN git lfs install \
    && git init -q . \
    && git remote add origin https://github.com/livekit-examples/meet.git \
    && git fetch --depth 1 origin "$MEET_COMMIT" \
    && git checkout -q FETCH_HEAD \
    && git lfs pull

RUN corepack enable && corepack prepare pnpm@10.18.2 --activate
RUN pnpm install --frozen-lockfile

# LIVEKIT_API_KEY/SECRET/URL are read server-side at request time, not baked
# into the build - real values are supplied at container runtime instead.
RUN pnpm build

EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
