# Frontend Dockerfile
FROM node:20 as build
WORKDIR /app
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_BASE_PATH
ARG PUBLIC_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_BASE_PATH=$REACT_APP_BASE_PATH
ENV PUBLIC_URL=$PUBLIC_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve the static files
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
