# Game server image (Render, Fly.io, Railway, any Docker host).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/game-server ./apps/game-server
RUN npm install --workspace @campus/game-server --workspace @campus/shared --include-workspace-root=false
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npx", "tsx", "apps/game-server/src/index.ts"]
