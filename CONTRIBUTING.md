# Contributing to saga-bus

Thank you for your interest in contributing to saga-bus! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Adding New Packages](#adding-new-packages)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Add the upstream remote**: `git remote add upstream https://github.com/d-e-a-n-f/saga-bus.git`
4. **Create a branch** for your changes: `git checkout -b feature/my-feature`

## Development Setup

### Prerequisites

- Node.js 20 or later
- pnpm 9 or later
- Docker (for integration tests)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/saga-bus.git
cd saga-bus

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm check-types

# Lint
pnpm lint
```

### Running Examples

```bash
# Start infrastructure (PostgreSQL, RabbitMQ, Redis, etc.)
docker-compose up -d

# Run an example
cd apps/example-loan-nextjs
pnpm dev
```

## Project Structure

```
saga-bus/
├── packages/                 # Library packages (published to npm)
│   ├── core/                # Core types, DSL, and runtime
│   ├── test/                # Testing utilities
│   ├── transport-*/         # Transport implementations
│   ├── store-*/             # Store implementations
│   ├── middleware-*/        # Middleware packages
│   ├── nestjs/              # NestJS integration
│   ├── nextjs/              # Next.js integration
│   ├── express/             # Express integration
│   ├── fastify/             # Fastify integration
│   └── hono/                # Hono integration
├── apps/                    # Example applications (not published)
│   ├── example-worker/      # Background worker example
│   ├── example-nextjs/      # Next.js example
│   ├── example-nestjs/      # NestJS example
│   └── ...
├── packages/eslint-config/  # Shared ESLint configuration
├── packages/typescript-config/ # Shared TypeScript configuration
└── turbo.json               # Turborepo configuration
```

## Development Workflow

### Working on a Package

```bash
# Watch mode for a specific package
pnpm --filter @saga-bus/core dev

# Run tests for a specific package
pnpm --filter @saga-bus/core test

# Type check a specific package
pnpm --filter @saga-bus/core check-types
```

### Building

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @saga-bus/core build
```

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @saga-bus/core test

# Run tests in watch mode
pnpm --filter @saga-bus/core test:watch

# Run with coverage
pnpm --filter @saga-bus/core test -- --coverage
```

### Integration Tests

Integration tests require Docker services:

```bash
# Start services
docker-compose up -d

# Run integration tests
pnpm --filter @saga-bus/store-postgres test
pnpm --filter @saga-bus/transport-rabbitmq test
```

### Writing Tests

- Place tests in `__tests__/` directory within each package
- Use descriptive test names that explain the behavior
- Test both success and error cases
- Use the `@saga-bus/test` harness for saga testing

```typescript
import { TestHarness } from "@saga-bus/test";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

describe("MySaga", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = await TestHarness.create({
      sagas: [{ definition: MySaga, store: new InMemorySagaStore() }],
    });
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("should handle message", async () => {
    await harness.publish({ type: "MyMessage", id: "123" });
    await harness.waitForIdle();

    const state = await harness.getSagaState("MySaga", "123");
    expect(state?.status).toBe("completed");
  });
});
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for public APIs
- Add JSDoc comments for exported functions and types

### Formatting

- Use Prettier for formatting (configured in the project)
- Run `pnpm format` to format all files

### Linting

- ESLint is configured for the project
- Run `pnpm lint` to check for issues
- Fix issues before submitting PRs

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Scope

Use the package name without the `@saga-bus/` prefix:

- `feat(core): add timeout support`
- `fix(transport-rabbitmq): handle reconnection`
- `docs(store-postgres): update README`

### Examples

```
feat(core): add saga timeout support

- Add setTimeout, clearTimeout, getTimeoutRemaining to SagaContext
- Add SagaTimeoutExpired message type
- Update SagaOrchestrator to handle timeouts
```

```
fix(store-postgres): handle connection pool exhaustion

Fixes #123
```

## Pull Request Process

1. **Update your fork** with the latest upstream changes
2. **Create a feature branch** from `main`
3. **Make your changes** with clear, focused commits
4. **Add/update tests** for your changes
5. **Update documentation** if needed
6. **Run all checks** locally:
   ```bash
   pnpm build
   pnpm check-types
   pnpm lint
   pnpm test
   ```
7. **Push your branch** and create a Pull Request
8. **Fill out the PR template** with all relevant information
9. **Address review feedback** promptly

### PR Requirements

- All CI checks must pass
- At least one approval from a maintainer
- No unresolved conversations
- Up-to-date with the target branch

## Adding New Packages

### Package Template

New packages should follow this structure:

```
packages/{type}-{name}/
├── src/
│   ├── index.ts           # Public exports
│   ├── {Name}.ts          # Main implementation
│   └── types.ts           # TypeScript types
├── __tests__/
│   └── {Name}.test.ts     # Tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
└── README.md
```

### package.json Template

```json
{
  "name": "@saga-bus/{type}-{name}",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src/",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@saga-bus/core": "workspace:*"
  },
  "peerDependencies": {
    // External dependencies that users must install
  }
}
```

### README Template

Each package should have a README with:

- Package description
- Installation instructions
- Quick start example
- Configuration options
- API reference
- License

## Questions?

- Open a [GitHub Issue](https://github.com/d-e-a-n-f/saga-bus/issues) for bugs or feature requests
- Start a [Discussion](https://github.com/d-e-a-n-f/saga-bus/discussions) for questions

Thank you for contributing!
