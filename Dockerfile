# Use official Node.js 20 image
FROM node:20

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (from .env or default 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
