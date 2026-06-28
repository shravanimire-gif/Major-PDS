# Stage 1: Build Admin Panel
FROM node:20-alpine AS build-admin
WORKDIR /app/pds-admin
COPY pds-admin/package*.json ./
RUN npm install
COPY pds-admin/ ./
RUN npm run build

# Stage 2: Build Shopkeeper App
FROM node:20-alpine AS build-shopkeeper
WORKDIR /app/pds-shopkeeper
COPY pds-shopkeeper/package*.json ./
RUN npm install
COPY pds-shopkeeper/ ./
RUN npm run build

# Stage 3: Setup Backend & Nginx
FROM node:20-alpine
WORKDIR /app

# Install Nginx and process manager (supervisor)
RUN apk add --no-cache nginx supervisor

# Copy built frontends
COPY --from=build-admin /app/pds-admin/dist /usr/share/nginx/html/admin
COPY --from=build-shopkeeper /app/pds-shopkeeper/dist /usr/share/nginx/html/shopkeeper

# Setup Backend
WORKDIR /app/pds-backend
COPY pds-backend/package*.json ./
RUN npm install --production
COPY pds-backend/ ./

# Create Nginx configuration
RUN echo '\
server {\n\
    listen 80;\n\
    root /usr/share/nginx/html/admin;\n\
    index index.html;\n\
    \n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    \n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:5000/api/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
    }\n\
    \n\
    location /auth/ {\n\
        proxy_pass http://127.0.0.1:5000/auth/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
    }\n\
}\n\
\n\
server {\n\
    listen 81;\n\
    root /usr/share/nginx/html/shopkeeper;\n\
    index index.html;\n\
    \n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    \n\
    location /api/ {\n\
        proxy_pass http://127.0.0.1:5000/api/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
    }\n\
    \n\
    location /auth/ {\n\
        proxy_pass http://127.0.0.1:5000/auth/;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade $http_upgrade;\n\
        proxy_set_header Connection "upgrade";\n\
        proxy_set_header Host $host;\n\
        proxy_cache_bypass $http_upgrade;\n\
    }\n\
}' > /etc/nginx/http.d/default.conf

# Create Supervisord configuration to run both Nginx and Node.js
RUN echo '\
[supervisord]\n\
nodaemon=true\n\
\n\
[program:nginx]\n\
command=nginx -g "daemon off;"\n\
autostart=true\n\
autorestart=true\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
\n\
[program:backend]\n\
command=npm start\n\
directory=/app/pds-backend\n\
autostart=true\n\
autorestart=true\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
' > /etc/supervisord.conf

# Expose ports
# 80: Admin Panel
# 81: Shopkeeper App
# 5000: Direct Backend Access (optional)
EXPOSE 80 81 5000

# Start Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
