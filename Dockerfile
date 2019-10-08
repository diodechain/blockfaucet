FROM node:11-alpine

ARG DEFAULT_BLOCKFAUCET_PORT
ENV BLOCKFAUCET_PORT=$DEFAULT_BLOCKFAUCET_PORT

EXPOSE $BLOCKFAUCET_PORT

RUN echo "default port $DEFAULT_BLOCKFAUCET_PORT $BLOCKFAUCET_PORT"

ADD package.json /blockfaucet/package.json
ADD index.js /blockfaucet/index.js
ADD config.json /blockfaucet/config.json
ADD wallet.json /blockfaucet/wallet.json

RUN apk add --update git python make gmp-dev alpine-sdk automake libtool autoconf

RUN cd /blockfaucet && \
    npm install

WORKDIR /blockfaucet

CMD ["npm", "start"]