# -----------------------------
# 1️⃣ Build Stage
# -----------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy dependency files first for better caching
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Run the build script
RUN pnpm run build

# -----------------------------
# 2️⃣ Production Stage
# -----------------------------
FROM node:22-alpine

WORKDIR /app

# Install pnpm for production dependency installation
RUN npm install -g pnpm@latest

# Copy package files and the bundled build
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Cleanup pnpm cache to reduce image size
RUN pnpm store prune

# Common environment variables
ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["node", "dist/index.cjs"]