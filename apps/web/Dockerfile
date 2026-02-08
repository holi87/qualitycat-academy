FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
EXPOSE 8080
CMD ["npm", "run", "dev"]

FROM deps AS build
ARG VITE_API_URL=/api
ARG VITE_BUGS=off
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_BUGS=${VITE_BUGS}
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
