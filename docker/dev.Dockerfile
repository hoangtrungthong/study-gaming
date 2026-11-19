# Môi trường phát triển game: Node 22 + pnpm (theo packageManager) + Chromium cho Playwright.
# Mã nguồn không chép vào image; docker-compose.yml gắn thư mục repo vào /app.
FROM node:22-bookworm-slim

# Giữ trùng bản @playwright/test trong pnpm-lock.yaml, nếu không Playwright báo thiếu trình duyệt.
ARG PLAYWRIGHT_VERSION=1.65.1
ARG PNPM_VERSION=11.28.11

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true

RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
    && rm -rf /root/.npm /var/lib/apt/lists/*

WORKDIR /app
EXPOSE 5173 4173
