FROM node:24-alpine
WORKDIR /app
COPY package.json .
RUN apk add --no-cache python3 make g++ \
    && npm install
