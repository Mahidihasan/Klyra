# Contribution Guide

## Welcome

Thank you for considering contributing to the API Marketplace project! This guide will help you understand how to contribute effectively.

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Focus on constructive feedback
- Accept constructive criticism gracefully
- Show empathy towards other community members

## Getting Started

### 1. Fork the Repository

1. Navigate to the repository on GitHub
2. Click the "Fork" button in the top right corner
3. Clone your fork locally:

```bash
git clone https://github.com/your-username/api-marketplace.git
cd api-marketplace
```

### 2. Set Up Your Development Environment

Follow the [Setup Guide](setup-guide.md) to configure your development environment.

### 3. Create a Branch

Create a branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Testing improvements

## Development Workflow

### 1. Understand the Codebase

- Read the [System Architecture](../architecture/system-architecture.md)
- Review the [Coding Standards](coding-standards.md)
- Explore the project structure

### 2. Make Changes

- Follow the [Coding Standards](coding-standards.md)
- Write tests for your changes
- Keep changes focused and minimal

### 3. Run Tests

Ensure all tests pass:

```bash
pnpm test
```

### 4. Lint and Format

```bash
pnpm lint
pnpm format
```

### 5. Commit Your Changes

Use conventional commits:

```bash
git add .
git commit -m "feat: add user profile page"
```

### 6. Push and Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Pull Request Process

### PR Requirements

1. **Description** - Clear description of changes
2. **Related Issues** - Reference related issues
3. **Tests** - Include tests for new functionality
4. **Documentation** - Update relevant documentation
5. **Screenshots** - Include screenshots for UI changes

### PR Review Process

1. Maintainers will review your PR within 2-3 business days
2. Address review feedback
3. Ensure CI pipeline passes
4. PR will be merged once approved

## Testing Guidelines

### Write Meaningful Tests

- Test both success and failure scenarios
- Test edge cases
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Coverage

- Aim for at least 80% coverage on new code
- Cover critical business logic
- Mock external dependencies

## Documentation Guidelines

- Update documentation for any user-facing changes
- Use clear, concise language
- Include code examples where appropriate
- Follow existing documentation structure

## Reporting Bugs

When reporting bugs, include:

1. **Title** - Clear, descriptive title
2. **Environment** - OS, browser, Node version
3. **Steps to Reproduce** - Detailed steps
4. **Expected Behavior** - What should happen
5. **Actual Behavior** - What actually happened
6. **Screenshots** - If applicable
7. **Additional Context** - Any other relevant info

## Feature Requests

When requesting features, include:

1. **Problem Statement** - What problem will this solve?
2. **Proposed Solution** - How should it work?
3. **Alternative Solutions** - Any alternatives considered
4. **Impact** - What will be affected?

## Community

- **Issues:** Use GitHub Issues for bug reports and feature requests
- **Discussions:** Use GitHub Discussions for questions and ideas
- **PR Reviews:** Feel free to review other PRs and provide feedback

## Questions?

If you have questions, feel free to:

1. Open a GitHub Discussion
2. Comment on relevant issues
3. Join our community channels

Thank you for contributing to the API Marketplace project!