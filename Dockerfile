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

RUN npm install -g serve

COPY --from=builder /app/build ./build

EXPOSE 7860

CMD ["serve", "-s", "build", "-l", "7860"]