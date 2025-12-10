# @repo/typescript-config

Shared TypeScript configurations for the saga-bus monorepo.

## Configurations

- `base.json` - Base configuration with strict settings
- `library.json` - Configuration for library packages (extends base)

## Usage

```json
{
  "extends": "@repo/typescript-config/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

## License

MIT
