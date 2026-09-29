FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
# package-lock.json is committed for reproducible production builds.
# The fallback keeps older checkouts buildable if they only contain package.json.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev --no-audit --no-fund; fi
COPY src ./src
COPY sql ./sql
RUN mkdir -p /app/keys /app/uploads
EXPOSE 3000
CMD ["node", "src/server.js"]
