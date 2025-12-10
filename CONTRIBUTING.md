# Contributing to saga-bus

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build packages: `pnpm build`
4. Run tests: `pnpm test`

## Project Structure

```
saga-bus/
├── packages/           # Library packages
│   ├── core/          # Core types and runtime
│   ├── transport-*/   # Transport implementations
│   ├── store-*/       # Store implementations
│   ├── middleware-*/  # Middleware packages
│   └── test/          # Test utilities
└── turbo.json         # Turborepo configuration
```

## Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing patterns
- Add JSDoc for public APIs
- Write tests for new features

### Commits

- Use conventional commit messages
- Reference issues when applicable
- Keep commits focused and atomic

### Pull Requests

1. Create a branch from `main`
2. Make your changes
3. Add/update tests
4. Update documentation if needed
5. Submit PR with clear description

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @saga-bus/core test

# Run with coverage
pnpm test -- --coverage
```

## Questions?

Open an issue for questions or discussion.
