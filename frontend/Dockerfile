# Build admin app
FROM node:16-alpine AS admin-build

WORKDIR /app

WORKDIR /app

# Copy config files FIRST before npm install
COPY admin/angular.json ./
COPY admin/tsconfig*.json ./
COPY admin/package*.json ./

# Copy source code
COPY admin/src ./src
COPY admin/e2e ./e2e

# Install dependencies - skip postinstall scripts, build Angular directly  
RUN npm install --legacy-peer-deps --ignore-scripts && \
    ./node_modules/.bin/ng build nrts-prc-admin --prod --deploy-url=/admin/ --base-href=/admin/

# Build public app
FROM node:16-alpine AS public-build

WORKDIR /app

WORKDIR /app

# Copy config files FIRST before npm install
COPY public/angular.json ./
COPY public/tsconfig*.json ./
COPY public/package*.json ./

# Copy source code into src/ folder (angular.json expects sourceRoot: "src")
COPY public/app ./src/app
COPY public/assets ./src/assets
COPY public/environments ./src/environments
COPY public/e2e ./e2e
COPY public/*.ts ./src/
COPY public/*.scss ./src/
COPY public/*.html ./src/
COPY public/*.ico ./src/
COPY public/karma.conf.js ./src/
COPY public/tsconfig.app.json ./src/
COPY public/tsconfig.spec.json ./src/

# Install dependencies - skip postinstall scripts and linting, build Angular directly
RUN npm install --legacy-peer-deps --ignore-scripts && \
    ./node_modules/.bin/ng build nrts-prc-public --prod

# Runtime: serve both Angular apps with http-server
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

RUN npm install -g http-server

# Copy built apps from build stages
COPY --from=admin-build /app/dist ./dist/admin
COPY --from=public-build /app/dist ./dist/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD http-server dist/public -p 3000 -c-1 -s 2>/dev/null || exit 1

# Start both apps on different ports
CMD ["sh", "-c", "http-server dist/admin -p 4200 -c-1 -s & http-server dist/public -p 3000 -c-1 -s"]
