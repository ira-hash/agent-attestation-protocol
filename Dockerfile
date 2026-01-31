# AAP Verification Server
# Usage: docker build -t aap-server . && docker run -p 3000:3000 aap-server

FROM node:20-alpine

LABEL maintainer="ira-hash"
LABEL version="2.5.0"
LABEL description="AAP - The Reverse Turing Test"

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/server/package*.json ./packages/server/
COPY examples/express-verifier/package*.json ./examples/express-verifier/

RUN npm install --production --ignore-scripts

# Copy source
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY examples/express-verifier ./examples/express-verifier

# Create non-root user
RUN addgroup -g 1001 -S aap && \
    adduser -S aap -u 1001 -G aap && \
    chown -R aap:aap /app

USER aap

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "examples/express-verifier/server.js"]
