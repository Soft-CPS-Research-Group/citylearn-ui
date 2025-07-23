# Build the React app
FROM node:18 AS build

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Serve the static files with Nginx
FROM nginx:alpine

# Copy build files to Nginx public folder
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom Nginx config if needed
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
