# Stage 1: Use a slimmer official Node.js image
FROM node:18-bullseye-slim

# Set the working directory inside the container
WORKDIR /app

# Install Python3 and pip and clean up cache to save space
RUN apt-get update && apt-get install -y python3 python3-pip --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for server mode
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy package.json and lock files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of your application code into the container
COPY . .

# Build your Next.js application for production
RUN npm run build

# Expose the port your app will run on
EXPOSE 3000

# Set the default command to start the app in WASM mode.
ENV MODE=wasm
ENV PORT=3000

# The command to start your application in production
CMD ["npm", "start"]