# Contributing to Social Platform

Thank you for your interest in contributing to Social Platform! We welcome contributions from the community and are excited to see what you'll bring to the project.

## 🤝 How to Contribute

### Reporting Issues
- Use the GitHub issue tracker to report bugs
- Include detailed information about the issue
- Provide steps to reproduce the problem
- Include screenshots if applicable

### Suggesting Features
- Open an issue with the "feature request" label
- Describe the feature and its benefits
- Explain how it fits with the project's goals

### Code Contributions

#### Getting Started
1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature/fix
4. Make your changes
5. Test your changes thoroughly
6. Submit a pull request

#### Development Setup
```bash
# Clone your fork
git clone https://github.com/Shaishav13/social-platform.git
cd social-platform

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Set up environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start development servers from root
npm run dev:backend
# In another terminal:
npm run dev:frontend
```

#### Code Style
- Use TypeScript for all new code
- Follow the existing code style and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure your code is properly formatted

#### Testing
- Write tests for new features
- Ensure all existing tests pass
- Run the test suite before submitting:
```bash
npm run test:backend
npm run test:frontend
```

#### Pull Request Process
1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update the README if necessary
5. Create a clear pull request description

## 📋 Pull Request Guidelines

### Title Format
Use a clear, descriptive title:
- `feat: add user profile editing`
- `fix: resolve login authentication issue`
- `docs: update API documentation`
- `style: improve responsive design`

### Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots to help explain your changes
```

## 🏗️ Project Structure

Understanding the project structure will help you contribute effectively:

```
social-platform/
├── backend/            # Express TypeScript microservices backend
│   ├── src/            # Backend services, gateway, middleware
│   ├── config/         # Environment & tooling configurations
│   ├── scripts/        # Database migrations & seeds
│   └── uploads/        # Uploaded media assets
├── frontend/           # React 19 + TypeScript frontend
│   ├── src/            # Components, pages, contexts, styles
│   └── public/         # Static client assets
├── deployment/         # Docker Compose, Nginx, deployment specs
└── docs/               # Architecture & developer documentation
```

## 🎯 Areas for Contribution

We welcome contributions in these areas:

### Frontend
- UI/UX improvements
- New React components
- Performance optimizations
- Mobile responsiveness
- Accessibility improvements

### Backend
- API enhancements
- Database optimizations
- Security improvements
- New features
- Bug fixes

### Documentation
- API documentation
- Code comments
- User guides
- Developer documentation

### Testing
- Unit tests
- Integration tests
- End-to-end tests
- Performance tests

## 🔍 Code Review Process

1. All submissions require review
2. Maintainers will review your PR
3. Address any requested changes
4. Once approved, your PR will be merged

## 🚀 Release Process

- We use semantic versioning (SemVer)
- Releases are created from the main branch
- Release notes document all changes

## 📞 Getting Help

If you need help:
- Check existing issues and documentation
- Ask questions in GitHub discussions
- Reach out to maintainers

## 🙏 Recognition

Contributors will be recognized in:
- README acknowledgments
- Release notes
- Project documentation

Thank you for contributing to Social Platform! 🐦