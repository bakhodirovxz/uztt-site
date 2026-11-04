# UZTT Scoreboard — sayt ichida ishlaydi (/tv, /control, /overlay?court=N, /admin)
# Kontekst: apps/scoreboard. Paket o'rnatish shart emas.
# Port tashqariga ochilmaydi: unga faqat web (proxy.ts, ruxsat tekshiruvi bilan) ulanadi.

FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=3101
ENV SB_HOST=0.0.0.0
ENV SB_DATA_DIR=/data
# PINFL ko'rinishidagi id bilan ishga tushmaydi (lib/playersdb.js)
ENV SB_PUBLIC=1
# Telegramga natija rasmi: /card sahifasini brauzer rasmga oladi
ENV BROWSER_NO_SANDBOX=1

RUN apk add --no-cache chromium font-noto
WORKDIR /app
COPY server.js site-bridge.js ./
COPY lib ./lib
COPY public ./public
RUN mkdir -p /data /app/public/players /app/public/ads && chown -R node:node /data /app/public
USER node

CMD ["node", "server.js"]
