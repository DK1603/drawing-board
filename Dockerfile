# Use Node.js LTS version for both building and serving
FROM node:16 AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (to leverage Docker caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Build the React frontend
RUN npm run build

# Use a lightweight Node.js image for running the app
FROM node:16

# Set the working directory
WORKDIR /app

# Copy only the backend and build folder from the builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./

# Install only production dependencies
RUN npm install --production

# Expose the application port
EXPOSE 5000

# Start the backend server
CMD ["node", "server.js"]
