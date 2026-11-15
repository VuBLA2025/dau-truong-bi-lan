# Đấu Trường Bi Lăn - Deploy lên Dokploy / Docker
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3006

EXPOSE 3006
CMD ["npx", "tsx", "server.ts"]
