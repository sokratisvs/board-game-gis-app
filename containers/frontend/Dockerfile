# Frontend Dockerfile
# Build path-agnostic: PUBLIC_URL/REACT_APP_BASE_PATH can be empty; BASE_PATH is set at runtime.
FROM node:20 as build
WORKDIR /app
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_BASE_PATH
ARG PUBLIC_URL
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
ENV REACT_APP_BASE_PATH=${REACT_APP_BASE_PATH}
ENV PUBLIC_URL=${PUBLIC_URL}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve the static files; nginx config and BASE_PATH injection happen at container start
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY --from=build /app/nginx-path.conf.template /etc/nginx/nginx-path.conf.template
COPY --from=build /app/nginx-root.conf /etc/nginx/nginx-root.conf
COPY --from=build /app/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
