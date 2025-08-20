# Stage 1: Use an official Node.js image that includes Python
FROM node:18-bullseye

# Set the working directory inside the container
WORKDIR /app

# Install Python dependencies for server mode
# Copy the requirements file first to leverage Docker cache
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
# This can be overridden in Render's environment variables.
ENV MODE=wasm
ENV PORT=3000

# The command to start your application in production
CMD ["npm", "start"]