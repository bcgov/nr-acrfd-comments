# Build admin app
FROM node:20-slim AS admin-build

WORKDIR /app

# Copy config files and dependencies
COPY admin/package*.json ./
COPY admin/angular.json ./
COPY admin/tsconfig*.json ./

# Copy source code
COPY admin/src ./src
COPY admin/e2e ./e2e

# Install dependencies and build
RUN npm install --legacy-peer-deps && \
    ./node_modules/.bin/ng build nrts-prc-admin --prod --deploy-url=/admin/ --base-href=/admin/

# Build public app
FROM node:20-slim AS public-build

WORKDIR /app

# Copy config files and dependencies
COPY public/package*.json ./
COPY public/angular.json ./
COPY public/tsconfig*.json ./

# Copy source code (public has flat structure, not under src/)
COPY public/app ./app
COPY public/assets ./assets
COPY public/environments ./environments
COPY public/e2e ./e2e
COPY public/index.html ./
COPY public/main.ts ./
COPY public/polyfills.ts ./
COPY public/styles.scss ./
COPY public/test.ts ./
COPY public/karma.conf.js ./
COPY public/tsconfig.app.json ./
COPY public/tsconfig.spec.json ./
COPY public/typings.d.ts ./

# Install dependencies and build
RUN npm install --legacy-peer-deps && \
    ./node_modules/.bin/ng build nrts-prc-public --prod

# Build custom Caddy binary with Coraza WAF plugin
FROM caddy:2.11.2-builder AS caddy
# Install CA certificates for Go module downloads; libcap for setcap
RUN apk add --no-cache ca-certificates libcap
RUN xcaddy build \
    --with github.com/corazawaf/coraza-caddy/v2
# Strip file capabilities here so the final image does not need libcap
RUN setcap -r /usr/bin/caddy

# Deploy: use Alpine (not caddy:2.10.2-alpine) because we use our own custom Caddy
# binary from the caddy stage—we never use the Caddy image's binary. Plain Alpine
# keeps dependencies explicit and avoids coupling to the Caddy image's layout.
FROM alpine:3.23.3
RUN apk add --no-cache ca-certificates

# Copy custom Caddy binary (capabilities already stripped in caddy stage; satisfies KSV022)
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy

# Copy built apps from build stages into appropriate directories for Caddy
COPY --from=admin-build /app/dist /srv/admin
COPY --from=public-build /app/dist /srv/public

# Copy Caddyfile and Coraza config
COPY Caddyfile /etc/caddy/Caddyfile
COPY coraza.conf /etc/caddy/coraza.conf

# Set permissions for static files (OpenShift-compatible)
# OpenShift uses random UIDs but assigns them to root group (GID 0)
RUN chown -R 1001:0 /srv && \
    chmod -R 755 /srv

# Create directories for Coraza WAF with restricted permissions
RUN mkdir -p /tmp/coraza && \
    chown -R 1001:0 /tmp/coraza && \
    chmod -R 770 /tmp/coraza

RUN /usr/bin/caddy fmt /etc/caddy/Caddyfile

EXPOSE 3000 3001
# OpenShift ignores HEALTHCHECK; kept for Trivy/Docker best practices. Uses busybox wget (no curl).
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:3001/health || exit 1

USER 1001
ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
