# Blockfaucet

An Ethereum faucet with a React frontend and a REST API. Works on any network you configure (and fund the faucet account of course). Check twitter post

# Prerequisites

- A running local GETH node. ( or access to a node like Infura ) with RPC-JSON enabled.

# Installing

```
$ cd blockfaucet
$ npm install
$ cd static
$ yarn build
$ cd ..
$ npm start
```

## Configuring the faucet API

Create a wallet `wallet.json`

```
$ node faucet.js

$ mkwallet <password> <fileName>
```

Read wallet `wallet.json`

```
$ node faucet.js

$ rdwallet <password> <fileName>
```

You can change `test` to whatever the password is that you want to encrypt your wallet with.

Create a config file `config.json` from `config.example.js`

```
{
	"etherscanroot": "http://testnet.etherscan.io/address/",
	"payoutfrequencyinsec": 60,
	"payoutamountinether": 0.1,
	"queuesize": 5,
	"httpport": 3000,
	"web3": {
		"host": "http://<YOUR ETH NODE>:8545"
	},
	"wallet": {
		"filename": "",
		"password": ""
	},
    "twitter": {
		"consumer_key": "",
		"consumer_secret": "",
		"access_token_key": "",
		"access_token_secret": ""
	}
}
```

Start your faucet:

```
$ node index.js
```


## Configuring the faucet frontend

edit the file `static/src/config.js` and specify the base URL for your API

# Development

## Frontend

```
$ cd static
$ npm start
```

## Server

```
$ npm run dev
```
