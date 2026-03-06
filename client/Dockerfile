# Frontend Dockerfile (Vite)
# Build
FROM node:20 as build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ARG VITE_BUILD_HASH=unknown
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BUILD_HASH=${VITE_BUILD_HASH}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

RUN npm run build

# Runtime
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
