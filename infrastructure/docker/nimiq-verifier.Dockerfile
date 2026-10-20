FROM node:24-bookworm-slim AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@11.4.0 --activate

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/nimiq-verifier/package.json services/nimiq-verifier/package.json
RUN pnpm install --frozen-lockfile --prod --filter @sidequest/nimiq-verifier...

FROM node:24-bookworm-slim AS runtime

RUN useradd --create-home --uid 10001 sidequest
WORKDIR /workspace
COPY --from=dependencies --chown=sidequest:sidequest /workspace/node_modules ./node_modules
COPY --from=dependencies --chown=sidequest:sidequest /workspace/services/nimiq-verifier/node_modules ./services/nimiq-verifier/node_modules
COPY --chown=sidequest:sidequest services/nimiq-verifier/package.json services/nimiq-verifier/package.json
COPY --chown=sidequest:sidequest services/nimiq-verifier/src services/nimiq-verifier/src

USER sidequest
ENV VERIFIER_HOST=0.0.0.0 \
    VERIFIER_PORT=8090 \
    NIMIQ_LOG_LEVEL=warn
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=4s --start-period=45s --retries=8 \
  CMD node -e "fetch('http://127.0.0.1:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "./services/nimiq-verifier/src/node-globals.mjs", "services/nimiq-verifier/src/server.mjs"]
