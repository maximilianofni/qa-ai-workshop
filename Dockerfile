# Imagen con los tests de Playwright: el mismo entorno (Node, Chrome y dependencias) en cualquier
# PC, en Jenkins o en Kubernetes. Se construye y se corre con scripts/docker.cjs (npm run docker:*).
# Las credenciales no van en la imagen: se pasan al correrla (--env-file .env o un Secret).
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /qa
ENV CI=true \
    CYPRESS_INSTALL_BINARY=0 \
    PLAYWRIGHT_HTML_OPEN=never

COPY package.json package-lock.json ./
RUN npm ci
# Los tests usan Google Chrome (channel: 'chrome'); la imagen trae Chromium
RUN npx playwright install --with-deps chrome

COPY playwright.config.ts ./
COPY tests ./tests

# Por defecto, los productos web; se cambia pasando otros argumentos a "docker run"
CMD ["npx", "playwright", "test", "--project=anpr", "--project=biblioteca-digital"]
