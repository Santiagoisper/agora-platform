FROM node:22-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

COPY . .

ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-lc", "npm run dev -- --hostname 0.0.0.0 -p 3000"]
