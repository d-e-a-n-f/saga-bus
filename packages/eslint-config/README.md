# @repo/eslint-config

Shared ESLint configurations for the saga-bus monorepo.

## Configurations

| Config | Description |
|--------|-------------|
| `base` | Base TypeScript rules |
| `library` | For publishable library packages |
| `react-internal` | For internal React packages |
| `next-js` | For Next.js applications |

## Usage

```javascript
// eslint.config.js
import library from "@repo/eslint-config/library";

export default [...library];
```

## Available Configs

### `@repo/eslint-config/base`
Base configuration with TypeScript support.

### `@repo/eslint-config/library`
Extended configuration for library packages with stricter rules.

### `@repo/eslint-config/react-internal`
Configuration for internal React components.

### `@repo/eslint-config/next-js`
Configuration for Next.js applications with Next.js specific rules.
