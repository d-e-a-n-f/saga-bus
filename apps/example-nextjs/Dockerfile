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
COPY apps/example-nextjs ./apps/example-nextjs

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the app and its dependencies
RUN pnpm turbo run build --filter=@saga-bus/example-nextjs

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone build
COPY --from=builder /app/apps/example-nextjs/.next/standalone ./
COPY --from=builder /app/apps/example-nextjs/.next/static ./apps/example-nextjs/.next/static
COPY --from=builder /app/apps/example-nextjs/public ./apps/example-nextjs/public

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the server
CMD ["node", "apps/example-nextjs/server.js"]
