FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/angular-ui/package.json apps/angular-ui/package.json
RUN npm ci --workspace apps/angular-ui
COPY apps/angular-ui apps/angular-ui
RUN npm --workspace apps/angular-ui run build

FROM nginx:1.27-alpine
COPY apps/angular-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/angular-ui/dist/amberkitchen-angular-ui/browser /usr/share/nginx/html
EXPOSE 80
