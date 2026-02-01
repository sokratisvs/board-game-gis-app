# Frontend Dockerfile (Vite)
# Build
FROM node:20 as build
WORKDIR /app
ARG REACT_APP_API_BASE_URL
ENV VITE_API_BASE_URL=${REACT_APP_API_BASE_URL}
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
