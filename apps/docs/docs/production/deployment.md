---
sidebar_position: 1
title: Deployment
---

# Deployment

Coming soon.

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "dist/index.js"]
```

## Kubernetes

Coming soon.
