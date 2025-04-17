# Use a newer Node.js runtime as a parent image
FROM node:20

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Remove the old package-lock.json file
RUN rm -f package-lock.json

# Update npm to the latest version
RUN npm install -g npm@latest

# Install Python and other build tools required by node-gyp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && apt-get clean

# Set the PYTHON environment variable for node-gyp
ENV PYTHON=/usr/bin/python3

# Set the NODE_OPTIONS environment variable to enable OpenSSL legacy provider
ENV NODE_OPTIONS=--openssl-legacy-provider

# Remove node-sass and install sass as a replacement
RUN npm uninstall node-sass && npm install sass --save-dev

# Clean install: remove node_modules and package-lock.json, then install dependencies
#RUN rm -rf node_modules package-lock.json && npm install

# Install cross-env globally to ensure it is available
RUN npm install -g cross-env

# Install webpack globally to ensure it is available
RUN npm install -g webpack

# Update Browserslist database
RUN npx browserslist@latest --update-db

# Copy the rest of the application source code
COPY . .

# Default command to run when the container starts
CMD ["npm", "run", "build-chrome:dev"]