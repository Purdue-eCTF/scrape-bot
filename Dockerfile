FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .

CMD ["npm", "start"]
