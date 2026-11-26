FROM node:22-alpine

WORKDIR /app

COPY package.json ./

# Install dependencies, using --legacy-peer-deps for compatibility
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3003

# The dev script already passes --port 3003 --host
CMD ["npm", "run", "dev"]
