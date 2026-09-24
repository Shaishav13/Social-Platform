# Social Platform

[Live Demo](https://social-platform-murex.vercel.app)

## Features
- **Real-time Feed**: Instantly see new posts and interactions using WebSockets.
- **Redis Caching**: High performance and reduced database load for feeds and sessions.
- **User Authentication**: Secure JWT-based login and registration.
- **Social Interactions**: Follow users, like posts, and leave comments.
- **Media Uploads**: Support for image and video uploads.

## How to run locally

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/Shaishav13/social-platform.git
cd social-platform
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Step 2: Database & Env Setup
```bash
# Setup Postgres DB
createdb social_media_platform
psql -d social_media_platform -f backend/scripts/init-db.sql

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 3: Run the servers
```bash
# Start backend (from root)
npm run dev:backend

# Start frontend (in another terminal)
npm run dev:frontend
```

# Social Platform

A modern, Instagram-inspired social media platform built with React, TypeScript, Node.js, and PostgreSQL. Features real-time interactions, media sharing, and a professional, responsive UI.

![Social Platform](https://img.shields.io/badge/Social-Platform-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)

## Features

### Authentication & User Management
- **Secure Authentication**: JWT-based authentication with refresh tokens
- **User Registration & Login**: Complete user onboarding flow
- **Profile Management**: Edit profile, upload profile pictures, manage privacy settings
- **Account Deletion**: Complete data removal with password confirmation

### Social Features
- **Posts**: Create, edit, and delete posts with text and media
- **Media Support**: Upload and share images and videos
- **Interactions**: Like, comment, and share posts
- **Real-time Updates**: Live notifications and feed updates
- **Follow System**: Follow/unfollow users, view followers and following
- **Comments**: Nested comment system with reply functionality

### Discovery & Exploration
- **Explore Page**: Discover trending posts and suggested users
- **Search**: Find users and posts with advanced search functionality
- **Trending Posts**: Algorithm-based trending content discovery
- **User Suggestions**: Smart user recommendations

### Modern UI/UX
- **Instagram-Inspired Design**: Clean, professional interface
- **Responsive Layout**: Optimized for desktop, tablet, and mobile
- **Professional Typography**: Clean, readable font system
- **Smooth Animations**: Polished user interactions

### Security & Performance
- **Rate Limiting**: API protection against abuse
- **Input Sanitization**: XSS and injection protection
- **CORS Configuration**: Secure cross-origin requests
- **Performance Monitoring**: Built-in metrics and monitoring
- **Database Optimization**: Efficient queries and indexing

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks and context
- **TypeScript** - Type-safe development
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **CSS3** - Custom styling with CSS variables
- **Vite** - Fast development and build tool

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **PostgreSQL** - Relational database
- **JWT** - Authentication tokens
- **Bcrypt** - Password hashing
- **Multer** - File upload handling

### Infrastructure
- **Docker** - Containerization
- **Nginx** - Reverse proxy and static file serving
- **Redis** - Session storage and caching

## Documentation

All comprehensive architectural and operational guides are organized in the [`docs/`](docs/) directory:

| Document | Description |
| :--- | :--- |
| [ Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Complete 100% free production deployment guide (Vercel, Render, Neon, Upstash) |
| [ API Reference](docs/API.md) | Microservices API endpoint catalog and request/response specifications |
| [ Development Guide](docs/DEVELOPMENT.md) | Local environment setup, environment variables, and dev workflows |
| [ Frontend Guide](docs/FRONTEND.md) | Frontend architecture, state management, and Wren design system |
| [ Security Audit Report](docs/SECURITY_AUDIT_REPORT.md) | Comprehensive security assessment and vulnerability remediations |
| [ Contributing Guidelines](docs/CONTRIBUTING.md) | Code standards, branching, and pull request guidelines |
| [ Roadmap & Tasks](docs/TODO.md) | Project roadmap, future milestones, and feature backlog |

## Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis (optional, for session storage)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/Shaishav13/social-platform.git
cd social-platform
```

### 2. Install Dependencies
```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb social_media_platform

# Run database initialization
psql -d social_media_platform -f backend/scripts/init-db.sql
```

### 4. Environment Configuration
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit .env files with your configuration
```

### 5. Start the Application
```bash
# Start backend (development) from root:
npm run dev:backend

# Start frontend (in another terminal):
npm run dev:frontend
```

The application will be available at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3003

## Configuration

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

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Storage
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif
ALLOWED_VIDEO_TYPES=video/mp4,video/mov,video/avi

# CORS Configuration
CORS_ORIGIN=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002
```

#### Frontend (frontend/.env)
```env
VITE_API_URL=http://localhost:3003/api/v1
VITE_APP_NAME=UdtaBirdie
```

## Project Structure

```
social-platform/
├──  config/                   # Configuration files
│   ├── .env.example            # Environment template
│   ├── .env.production         # Production environment
│   ├── .eslintrc.js           # ESLint configuration
│   ├── jest.config.js         # Jest configuration
│   └── tsconfig.json          # TypeScript configuration
├──  deployment/              # Deployment files
│   ├── docker-compose.yml     # Docker composition
│   ├── Dockerfile             # Docker image definition
│   └── nginx.conf             # Nginx configuration
├──  docs/                    # Documentation
│   ├── API.md                 # API documentation
│   ├── CONTRIBUTING.md        # Contribution guidelines
│   ├── DEPLOYMENT.md          # Deployment guide
│   ├── DEVELOPMENT.md         # Development setup
│   └── LICENSE                # MIT License
├──  frontend/                # React frontend application
│   ├──  src/
│   │   ├──  components/     # Reusable UI components
│   │   ├──  pages/          # Page components
│   │   ├──  contexts/       # React contexts
│   │   ├──  services/       # API services
│   │   ├──  types/          # TypeScript type definitions
│   │   └──  utils/          # Utility functions
│   └──  public/             # Static assets
├──  scripts/                # Database and utility scripts
│   ├── init-db.sql           # Database initialization
│   ├── setup-db.sql          # Additional setup
│   └── deploy.sh             # Deployment script
├──  src/                    # Backend source code
│   ├──  services/           # Microservices
│   │   ├──  auth/          # Authentication service
│   │   ├──  content/       # Content management
│   │   ├──  social/        # Social interactions
│   │   ├──  profile/       # User profiles
│   │   ├──  blog/          # Blog functionality
│   │   ├──  notification/  # Notifications
│   │   ├──  search/        # Search functionality
│   │   └──  moderation/    # Content moderation
│   ├──  middleware/         # Express middleware
│   ├──  config/            # Configuration files
│   ├──  utils/             # Utility functions
│   └──  test/              # Test files
├──  uploads/               # User uploaded files
└──  README.md              # This file
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user
- `DELETE /api/v1/auth/account` - Delete user account

### Content
- `GET /api/v1/content/feed` - Get user feed
- `POST /api/v1/content/posts` - Create new post
- `GET /api/v1/content/posts/:id` - Get specific post
- `PUT /api/v1/content/posts/:id` - Update post
- `DELETE /api/v1/content/posts/:id` - Delete post
- `POST /api/v1/content/upload` - Upload media files

### Social
- `POST /api/v1/social/posts/:id/like` - Like/unlike post
- `POST /api/v1/social/posts/:id/comments` - Add comment
- `POST /api/v1/social/users/:id/follow` - Follow/unfollow user
- `GET /api/v1/social/posts/:id/comments` - Get post comments

### Profile
- `GET /api/v1/profile/users/:id` - Get user profile
- `PUT /api/v1/profile/users/:id` - Update user profile
- `GET /api/v1/profile/search/users` - Search users

## Testing

### Test Users
The application comes with pre-configured test users:

| Username | Email | Password |
|----------|-------|----------|
| test | test@gmail.com | Test123! |
| testuser | test@example.com | Test123! |
| testuser2 | test2@example.com | Test123! |
| profiletestuser | profiletest@example.com | Test123! |

### Running Tests
```bash
# Backend tests
npm test

# Frontend tests
cd frontend
npm test
```

## Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Deployment
```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd ..
npm run build

# Start production server
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by Instagram's clean and professional design
- Built with modern web technologies and best practices
- Thanks to the open-source community for the amazing tools and libraries

## Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Check the documentation
- Review the API endpoints

---

**Developed with  by Shaishav** �

*Social Platform - Where conversations take flight* 