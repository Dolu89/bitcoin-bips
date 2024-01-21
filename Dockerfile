FROM node:21.5-alpine3.18 as BUILD_IMAGE
RUN apk add --update --no-cache
    
WORKDIR /usr/src/app

COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build
WORKDIR /usr/src/app/build
RUN pnpm install

FROM node:21.5-alpine3.18

WORKDIR /usr/src/app

# copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/build ./build

EXPOSE 3333

CMD [ "node", "bin/server.js" ]