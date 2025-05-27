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
RUN npm install --save-dev @types/bcryptjs @types/morgan @types/multer @types/jsonwebtoken
# Copy source code
COPY . .


# Run Prisma migrate before build
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port (from .env or default 3000)
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
