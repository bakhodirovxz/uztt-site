# UZTT API — multi-stage build (pnpm monorepo)
# Kontekst: repo ildizi (docker-compose.yml shunday sozlangan)

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Avval faqat manifest fayllar — dependency keshi samarali ishlashi uchun
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @uztt/api...

# Manba kodi
COPY packages/shared packages/shared
COPY apps/api apps/api

# Prisma client generatsiya + build (main + seed)
WORKDIR /repo/apps/api
RUN pnpm prisma generate && pnpm build

# Izolyatsiyalangan production chiqish (faqat prod dependency'lar)
WORKDIR /repo
RUN pnpm --filter @uztt/api --prod deploy --legacy /out && \
    cp -r apps/api/dist /out/dist && \
    cp -r apps/api/prisma /out/prisma
# Deploy chiqishida Prisma clientni qayta generatsiya qilamiz
WORKDIR /out
RUN npx prisma generate

# ==================== runtime ====================
FROM node:22-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /out ./
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["docker-entrypoint.sh"]
