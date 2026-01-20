# 💻 Development Setup Guide

Complete guide for setting up Social Platform for local development.

## 🛠️ Prerequisites

- **Node.js**: Version 18 or higher
- **PostgreSQL**: Version 14 or higher
- **Redis**: Version 6 or higher (optional but recommended)
- **Git**: For version control
- **VS Code**: Recommended IDE with extensions

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/social-platform.git
cd social-platform
```

### 2. Install Dependencies
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb social_media_platform

# Initialize database schema
psql -d social_media_platform -f scripts/init-db.sql
```

### 4. Environment Configuration
```bash
# Copy environment files
cp config/.env.example .env
cp frontend/.env.example frontend/.env

# Edit environment files with your configuration
```

### 5. Start Development Servers
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

**Access the application:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3003
- API Documentation: http://localhost:3003/api/docs

## 🔧 Development Environment

### Environment Variables

#### Backend (.env)
```env
# Server Configuration
PORT=3003
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=social_media_platform
DB_USER=postgres
DB_PASSWORD=your_password

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your-development-jwt-secret
JWT_REFRESH_SECRET=your-development-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif
ALLOWED_VIDEO_TYPES=video/mp4,video/mov,video/avi

# CORS Configuration
CORS_ORIGIN=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002,http://localhost:5173

# Rate Limiting (development-friendly)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500
```

#### Frontend (frontend/.env)
```env
VITE_API_URL=http://localhost:3003/api/v1
VITE_APP_NAME=UdtaBirdie
```

## 📁 Project Structure

```
social-platform/
├── 📁 config/                  # Configuration files
│   ├── .env.example           # Environment template
│   ├── .env.production        # Production environment
│   ├── .eslintrc.js          # ESLint configuration
│   ├── jest.config.js        # Jest configuration
│   └── tsconfig.json         # TypeScript configuration
├── 📁 deployment/             # Deployment files
│   ├── docker-compose.yml    # Docker composition
│   ├── Dockerfile            # Docker image definition
│   └── nginx.conf            # Nginx configuration
├── 📁 docs/                   # Documentation
│   ├── API.md                # API documentation
│   ├── CONTRIBUTING.md       # Contribution guidelines
│   ├── DEPLOYMENT.md         # Deployment guide
│   ├── DEVELOPMENT.md        # This file
│   └── LICENSE               # MIT License
├── 📁 frontend/               # React frontend
│   ├── 📁 src/
│   │   ├── 📁 components/    # Reusable components
│   │   ├── 📁 pages/         # Page components
│   │   ├── 📁 contexts/      # React contexts
│   │   ├── 📁 services/      # API services
│   │   ├── 📁 types/         # TypeScript types
│   │   └── 📁 utils/         # Utility functions
│   ├── 📁 public/            # Static assets
│   └── package.json          # Frontend dependencies
├── 📁 scripts/               # Database and utility scripts
│   ├── init-db.sql          # Database initialization
│   ├── setup-db.sql         # Additional setup
│   └── deploy.sh            # Deployment script
├── 📁 src/                   # Backend source code
│   ├── 📁 config/           # Configuration modules
│   ├── 📁 middleware/       # Express middleware
│   ├── 📁 services/         # Microservices
│   │   ├── 📁 auth/         # Authentication
│   │   ├── 📁 content/      # Content management
│   │   ├── 📁 social/       # Social features
│   │   ├── 📁 profile/      # User profiles
│   │   ├── 📁 blog/         # Blog functionality
│   │   ├── 📁 notification/ # Notifications
│   │   ├── 📁 search/       # Search functionality
│   │   └── 📁 moderation/   # Content moderation
│   ├── 📁 test/             # Test files
│   ├── 📁 utils/            # Utility functions
│   └── index.ts             # Application entry point
├── 📁 uploads/              # User uploaded files
└── package.json             # Backend dependencies
```

## 🧪 Testing

### Running Tests
```bash
# Backend tests
npm test

# Frontend tests
cd frontend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

### Test Users
The application comes with pre-configured test users:

| Username | Email | Password |
|----------|-------|----------|
| test | test@gmail.com | Test123! |
| testuser | test@example.com | Test123! |
| testuser2 | test2@example.com | Test123! |
| profiletestuser | profiletest@example.com | Test123! |

## 🔍 Debugging

### Backend Debugging
```bash
# Start with debugging enabled
npm run dev:debug

# Or with VS Code debugger
# Use the "Launch Program" configuration
```

### Frontend Debugging
```bash
# Start with source maps
cd frontend
npm run dev

# Use browser developer tools
# React Developer Tools extension recommended
```

### Database Debugging
```bash
# Connect to database
psql -d social_media_platform

# View tables
\dt

# Check recent posts
SELECT * FROM posts ORDER BY created_at DESC LIMIT 5;

# Check users
SELECT id, username, email, created_at FROM users;
```

## 📦 Available Scripts

### Backend Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Frontend Scripts
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
npm run lint         # Run ESLint
```

## 🛠️ Development Tools

### Recommended VS Code Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "ms-vscode.vscode-jest",
    "ms-vscode.vscode-postgres"
  ]
}
```

### VS Code Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## 🔄 Development Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/amazing-feature

# Make changes
# ... code changes ...

# Run tests
npm test
cd frontend && npm test && cd ..

# Commit changes
git add .
git commit -m "feat: add amazing feature"

# Push branch
git push origin feature/amazing-feature

# Create pull request
```

### 2. Code Quality
```bash
# Run linting
npm run lint
cd frontend && npm run lint && cd ..

# Fix linting issues
npm run lint:fix
cd frontend && npm run lint:fix && cd ..

# Run type checking
npx tsc --noEmit
cd frontend && npx tsc --noEmit && cd ..
```

### 3. Database Changes
```bash
# Create migration script
nano scripts/migration-YYYYMMDD-description.sql

# Test migration
psql -d social_media_platform -f scripts/migration-YYYYMMDD-description.sql

# Update init-db.sql for new installations
```

## 🐛 Common Issues

### Port Already in Use
```bash
# Find process using port
lsof -i :3003
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database Connection Issues
```bash
# Check PostgreSQL status
pg_ctl status

# Start PostgreSQL
pg_ctl start

# Check database exists
psql -l | grep social_media_platform
```

### Node Modules Issues
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
# Check TypeScript configuration
npx tsc --showConfig

# Restart TypeScript server in VS Code
# Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

## 📚 Learning Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/)

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

**Developed by Shaishav** 🚀