# Use official Node.js 20 image
FROM node:20

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./

# Install global dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev

RUN npm install --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (from .env or default 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
