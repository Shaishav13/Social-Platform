#!/bin/bash

# Production deployment script for Social Media Platform
set -e

echo "🚀 Starting deployment process..."

# Configuration
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3000}
PM2_APP_NAME=${PM2_APP_NAME:-social-media-platform}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required environment variables are set
check_environment() {
    echo "🔧 Checking environment configuration..."
    
    required_vars=(
        "DB_HOST"
        "DB_NAME" 
        "DB_USER"
        "DB_PASSWORD"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    print_status "Environment configuration validated"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    npm ci --only=production
    print_status "Dependencies installed"
}

# Build the application
build_application() {
    echo "🔨 Building application..."
    
    # Install dev dependencies for build
    npm ci
    
    # Run build
    npm run build
    
    if [ ! -d "dist" ]; then
        print_error "Build failed - dist directory not found"
        exit 1
    fi
    
    print_status "Application built successfully"
}

# Run database migrations and setup
setup_database() {
    echo "🗄️  Setting up database..."
    
    # Check database connection
    node -e "
        const { DatabaseConnection } = require('./dist/config/database');
        DatabaseConnection.initialize()
            .then(() => {
                console.log('Database connection successful');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Database connection failed:', error.message);
                process.exit(1);
            });
    "
    
    print_status "Database setup completed"
}

# Run security checks
security_check() {
    echo "🔒 Running security checks..."
    
    # Check for security vulnerabilities
    if command -v npm &> /dev/null; then
        npm audit --audit-level moderate
        if [ $? -ne 0 ]; then
            print_warning "Security vulnerabilities found. Please review and fix before deploying to production."
        fi
    fi
    
    # Check file permissions
    if [ -f ".env" ]; then
        chmod 600 .env
        print_status "Environment file permissions secured"
    fi
    
    print_status "Security checks completed"
}

# Setup SSL certificates (if provided)
setup_ssl() {
    if [ -n "$SSL_CERT_PATH" ] && [ -n "$SSL_KEY_PATH" ]; then
        echo "🔐 Setting up SSL certificates..."
        
        if [ ! -f "$SSL_CERT_PATH" ]; then
            print_error "SSL certificate not found at $SSL_CERT_PATH"
            exit 1
        fi
        
        if [ ! -f "$SSL_KEY_PATH" ]; then
            print_error "SSL private key not found at $SSL_KEY_PATH"
            exit 1
        fi
        
        # Set proper permissions
        chmod 644 "$SSL_CERT_PATH"
        chmod 600 "$SSL_KEY_PATH"
        
        print_status "SSL certificates configured"
    else
        print_warning "SSL certificates not configured. HTTPS will not be available."
    fi
}

# Setup process manager (PM2)
setup_pm2() {
    echo "⚙️  Setting up process manager..."
    
    # Install PM2 if not present
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${PM2_APP_NAME}',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: ${PORT}
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
EOF
    
    # Create logs directory
    mkdir -p logs
    
    print_status "PM2 configuration created"
}

# Setup monitoring and logging
setup_monitoring() {
    echo "📊 Setting up monitoring..."
    
    # Create log rotation configuration
    cat > /etc/logrotate.d/social-media-platform << EOF
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 app app
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    print_status "Monitoring and logging configured"
}

# Deploy the application
deploy_application() {
    echo "🚀 Deploying application..."
    
    # Stop existing application
    pm2 stop $PM2_APP_NAME 2>/dev/null || true
    
    # Start application with PM2
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup
    
    print_status "Application deployed successfully"
}

# Health check
health_check() {
    echo "🏥 Performing health check..."
    
    # Wait for application to start
    sleep 10
    
    # Check if application is responding
    if curl -f -s "http://localhost:${PORT}/health" > /dev/null; then
        print_status "Health check passed"
    else
        print_error "Health check failed"
        pm2 logs $PM2_APP_NAME --lines 50
        exit 1
    fi
}

# Cleanup
cleanup() {
    echo "🧹 Cleaning up..."
    
    # Remove development dependencies
    npm prune --production
    
    # Clear npm cache
    npm cache clean --force
    
    print_status "Cleanup completed"
}

# Main deployment process
main() {
    echo "🚀 Social Media Platform Deployment"
    echo "=================================="
    
    check_environment
    install_dependencies
    build_application
    setup_database
    security_check
    setup_ssl
    setup_pm2
    setup_monitoring
    deploy_application
    health_check
    cleanup
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "Application is running on port ${PORT}"
    echo ""
    echo "Useful commands:"
    echo "  pm2 status                 - Check application status"
    echo "  pm2 logs ${PM2_APP_NAME}   - View application logs"
    echo "  pm2 restart ${PM2_APP_NAME} - Restart application"
    echo "  pm2 stop ${PM2_APP_NAME}   - Stop application"
    echo ""
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"