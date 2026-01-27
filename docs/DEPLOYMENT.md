# 🚀 Deployment Guide

Complete guide for deploying Social Platform to production.

## 📋 Prerequisites

- **Server**: Ubuntu 20.04+ or similar Linux distribution
- **Node.js**: Version 18 or higher
- **PostgreSQL**: Version 14 or higher
- **Redis**: Version 6 or higher (optional but recommended)
- **Nginx**: For reverse proxy and static file serving
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)

## 🐳 Docker Deployment (Recommended)

### 1. Clone Repository
```bash
git clone https://github.com/Shaishav13/social-platform.git
cd social-platform
```

### 2. Configure Environment
```bash
# Copy and edit production environment file
cp config/.env.production .env
nano .env
```

### 3. Deploy with Docker Compose
```bash
# Build and start all services
docker-compose -f deployment/docker-compose.yml up -d

# Check logs
docker-compose -f deployment/docker-compose.yml logs -f
```

### 4. Initialize Database
```bash
# Run database initialization
docker-compose -f deployment/docker-compose.yml exec backend npm run db:init
```

## 🔧 Manual Deployment

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Nginx
sudo apt install nginx

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Database Setup
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE social_media_platform;
CREATE USER social_platform WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE social_media_platform TO social_platform;
\q

# Initialize database schema
psql -U social_platform -d social_media_platform -f scripts/init-db.sql
```

### 3. Application Setup
```bash
# Clone repository
git clone https://github.com/Shaishav13/social-platform.git
cd social-platform

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Build frontend
cd frontend && npm run build && cd ..

# Build backend
npm run build

# Copy environment file
cp config/.env.production .env
nano .env  # Edit with your configuration
```

### 4. Configure Environment Variables
```bash
# Edit .env file
nano .env
```

**Required Environment Variables:**
```env
NODE_ENV=production
PORT=3003
DB_HOST=localhost
DB_PORT=5432
DB_NAME=social_media_platform
DB_USER=social_platform
DB_PASSWORD=your_secure_password
JWT_SECRET=your_super_secure_jwt_secret
JWT_REFRESH_SECRET=your_super_secure_refresh_secret
CORS_ORIGIN=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

### 5. Start Application with PM2
```bash
# Start backend
pm2 start npm --name "social-platform-backend" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

### 6. Configure Nginx
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/social-platform
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # Frontend
    location / {
        root /path/to/social-platform/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Media files
    location /uploads/ {
        root /path/to/social-platform;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/social-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔧 Production Optimizations

### 1. Database Optimizations
```sql
-- Connect to database
psql -U social_platform -d social_media_platform

-- Create additional indexes for performance
CREATE INDEX CONCURRENTLY idx_posts_created_at_desc ON posts(created_at DESC);
CREATE INDEX CONCURRENTLY idx_posts_author_created ON posts(author_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_comments_post_created ON comments(post_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_likes_target_user ON likes(target_id, user_id);
CREATE INDEX CONCURRENTLY idx_follows_following_created ON follows(following_id, created_at DESC);

-- Update table statistics
ANALYZE;
```

### 2. Redis Configuration
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Recommended settings:
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 3. PM2 Configuration
```bash
# Create ecosystem file
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'social-platform-backend',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

```bash
# Start with ecosystem file
pm2 start ecosystem.config.js
```

## 📊 Monitoring & Logging

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs social-platform-backend

# Application metrics
curl http://localhost:3003/metrics
```

### 2. System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Database monitoring
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### 3. Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/social-platform
```

```
/path/to/social-platform/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🔄 Updates & Maintenance

### 1. Application Updates
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Build application
cd frontend && npm run build && cd ..
npm run build

# Restart application
pm2 restart social-platform-backend
```

### 2. Database Maintenance
```bash
# Regular maintenance script
#!/bin/bash
# maintenance.sh

# Vacuum and analyze database
psql -U social_platform -d social_media_platform -c "VACUUM ANALYZE;"

# Clean up old sessions
psql -U social_platform -d social_media_platform -c "DELETE FROM sessions WHERE expires_at < NOW();"

# Update statistics
psql -U social_platform -d social_media_platform -c "ANALYZE;"
```

### 3. Backup Strategy
```bash
# Database backup script
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/social-platform"
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U social_platform -h localhost social_media_platform > $BACKUP_DIR/db_$DATE.sql

# Media files backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

## 🚨 Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs social-platform-backend
   
   # Check environment variables
   pm2 env 0
   ```

2. **Database connection issues**
   ```bash
   # Test database connection
   psql -U social_platform -d social_media_platform -c "SELECT 1;"
   
   # Check PostgreSQL status
   sudo systemctl status postgresql
   ```

3. **File upload issues**
   ```bash
   # Check uploads directory permissions
   ls -la uploads/
   chmod 755 uploads/
   chown -R ubuntu:ubuntu uploads/
   ```

4. **High memory usage**
   ```bash
   # Monitor memory usage
   free -h
   pm2 monit
   
   # Restart application if needed
   pm2 restart social-platform-backend
   ```

---

**Developed by Shaishav** 🚀