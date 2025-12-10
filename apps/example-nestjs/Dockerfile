# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all packages (needed for workspace resolution)
COPY packages ./packages
COPY apps/example-nestjs ./apps/example-nestjs

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the app and its dependencies
RUN pnpm turbo run build --filter=@saga-bus/example-nestjs

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm for production
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/example-nestjs ./apps/example-nestjs

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/live || exit 1

# Start the app
CMD ["node", "apps/example-nestjs/dist/main.js"]
