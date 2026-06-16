# -----------------------------
# 1️⃣ Build Stage
# -----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# -----------------------------
# 2️⃣ Production Stage
# -----------------------------
FROM node:20-alpine

WORKDIR /app

# Copy production artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install production dependencies only
RUN npm install --omit=dev

# Common environment variables
ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["node", "dist/index.cjs"]