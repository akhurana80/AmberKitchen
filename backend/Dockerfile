FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY apps/angular-ui/package.json apps/angular-ui/package.json
RUN npm ci --workspace backend

FROM deps AS build
COPY backend backend
COPY database database
RUN npm --workspace backend run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace backend
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/scripts backend/scripts
COPY --from=build /app/database database
EXPOSE 4000
CMD ["npm", "--workspace", "backend", "run", "start"]
