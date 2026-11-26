FROM node:20-alpine AS build

WORKDIR /app/frontend-organization
COPY frontend-organization/package*.json ./
# Keep build tooling like Vite available even when host shell exports NODE_ENV=production.
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY frontend-organization/ ./
COPY shared-api/ ../shared-api/
COPY shared-session/ ../shared-session/
COPY shared-ui/ ../shared-ui/
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/frontend-organization/dist/ /usr/share/nginx/html/
COPY frontend-organization/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
