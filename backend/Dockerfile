# Build stage
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for potential build steps)
RUN npm install

# Copy app code
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start app
CMD ["npm", "start"]
