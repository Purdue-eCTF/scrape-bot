FROM node:20-alpine

RUN apk add --no-cache git openssl

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

CMD ["npm", "start"]
