# Coding Standards

## Overview

This document outlines the coding standards and best practices for the API Marketplace project.

## General Principles

1. **Consistency** - Follow existing patterns in the codebase
2. **Readability** - Write code that is easy to understand
3. **Maintainability** - Write code that is easy to modify and extend
4. **Testability** - Write code that is easy to test
5. **Performance** - Write efficient code without premature optimization

## TypeScript Standards

### Type Safety
- Use TypeScript strict mode
- Avoid `any` type - use `unknown` or proper types
- Define interfaces for complex objects
- Use proper type imports/exports

```typescript
// Good
interface UserProfile {
  id: string;
  email: string;
  name: string;
}

// Bad
const user: any = { id: '1', email: 'test@example.com' };
```

### Naming Conventions
- **Files:** `kebab-case` (e.g., `auth.controller.ts`)
- **Classes:** `PascalCase` (e.g., `AuthService`)
- **Functions:** `camelCase` (e.g., `getUserById`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_REQUESTS`)
- **TypeScript Interfaces:** `PascalCase` (e.g., `UserResponse`)
- **Variables:** `camelCase` (e.g., `userData`)

### Exports
- Use named exports for multiple items
- Use default exports for single components (React)

## Backend Standards

### Project Structure
```
modules/
  auth/
    auth.controller.ts
    auth.service.ts
    auth.routes.ts
    auth.validations.ts
    auth.types.ts
```

### Controllers
- Keep controllers thin - delegate logic to services
- Handle HTTP request/response
- Use consistent response format

```typescript
export const getUser = async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  return res.success({ data: user });
};
```

### Services
- Contain business logic
- Handle database operations
- Throw meaningful errors

```typescript
export class UserService {
  async getUserById(id: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
```

### Validation
- Use Zod schemas for request validation
- Validate all inputs
- Provide clear error messages

```typescript
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});
```

### Error Handling
- Use custom error classes
- Consistent error response format
- Log errors appropriately

```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
```

## Frontend Standards

### Component Structure
```
components/
  Button/
    Button.tsx
    Button.test.tsx
    index.ts
```

### React Component Standards
- Use functional components with hooks
- Use TypeScript for props
- Keep components focused and reusable
- Use proper naming conventions

```typescript
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, variant = 'primary', onClick }) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
};
```

### State Management
- Use Redux Toolkit for global state
- Use local state for component-specific state
- Use RTK Query for API calls
- Keep state normalized

### Styling
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Use CSS variables for theming

## Git Standards

### Commit Messages
Use conventional commits format:

```
feat: add user registration
fix: resolve payment webhook issue
docs: update API documentation
refactor: improve error handling
test: add unit tests for auth service
chore: update dependencies
```

### Branch Naming
```
feature/user-authentication
bugfix/payment-webhook
hotfix/security-patch
docs/update-readme
```

### Pull Requests
- Keep PRs focused and small
- Include meaningful description
- Reference related issues
- Ensure CI passes

## Testing Standards

### Test Structure
Use AAA pattern (Arrange, Act, Assert):

```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';

      // Act
      const user = await userService.getUserById(userId);

      // Assert
      expect(user.id).toBe(userId);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 'nonexistent';

      // Act & Assert
      await expect(userService.getUserById(userId)).rejects.toThrow('User not found');
    });
  });
});
```

### Test Coverage
- Aim for at least 80% coverage
- Test critical business logic
- Mock external dependencies
- Write meaningful test descriptions

## Code Review

### Self-Review Checklist
- [ ] Code follows naming conventions
- [ ] No debugging statements left
- [ ] Error handling is proper
- [ ] Input validation is complete
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No unnecessary complexity
- [ ] Performance considerations addressed

## Tools

- **Formatter:** Prettier
- **Linter:** ESLint
- **Type Checker:** TypeScript compiler
- **Testing:** Jest
- **Hooks:** Husky + lint-staged