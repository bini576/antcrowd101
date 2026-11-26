FROM node:20-alpine AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY frontend/ ./
COPY shared/ ../shared/
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/frontend/dist/ /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
