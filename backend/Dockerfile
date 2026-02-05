# Build stage
FROM node:22-alpine

# Install dependencies and build
WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy app code
COPY . .

# Runtime stage
FROM node:22-alpine
ENV NODE_ENV=production

# Install production dependencies only
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Copy app code from build stage
COPY --from=0 /app /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD curl -f http://localhost:3000/api || exit 1

# Start app
CMD ["npm", "start"]
