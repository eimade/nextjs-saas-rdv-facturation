# Image unique (app Next.js, worker de rappels, migrations) : simple à maintenir pour un MVP.
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 13000
CMD ["npm", "run", "start"]
