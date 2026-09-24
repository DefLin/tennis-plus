FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY sql ./sql
RUN mkdir -p /app/keys
EXPOSE 3000
CMD ["node", "src/server.js"]
