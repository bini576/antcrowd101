FROM node:20-alpine AS build
WORKDIR /app/external-researcher-frontend
COPY external-researcher-frontend/package*.json ./
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY external-researcher-frontend/ ./
COPY shared/ ../shared/
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/external-researcher-frontend/dist/ /usr/share/nginx/html/
COPY external-researcher-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
