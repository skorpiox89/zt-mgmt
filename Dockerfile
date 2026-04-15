FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:22-alpine3.22 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @zt-mgmt/server prisma:generate
RUN pnpm --filter @zt-mgmt/server build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @zt-mgmt/web build

FROM base AS server-runtime
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter @zt-mgmt/server exec prisma migrate deploy && pnpm --filter @zt-mgmt/server start"]

FROM base AS web-runtime
COPY --from=build /app /app
ENV NODE_ENV=production
ENV VITE_API_BASE_URL=http://server:3001/api
EXPOSE 4173
CMD ["pnpm", "--filter", "@zt-mgmt/web", "preview"]
