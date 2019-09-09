const express = require("express");
const app = express();
const cors = require("cors");
const Web3 = require("web3");
const Ethwallet = require("ethereumjs-wallet");
const config = require("./config.json");
const mkdirp = require("mkdirp");
const level = require("level");
const EthereumTx = require('ethereumjs-tx');
const Url = require('url');
const bodyParser = require('body-parser');
const Twitter = require('twitter');
const path = require('path');

const twitterClient = new Twitter({
  consumer_key: config.twitter.consumer_key,
  consumer_secret: config.twitter.consumer_secret,
  access_token_key: config.twitter.access_token_key,
  access_token_secret: config.twitter.access_token_secret
});

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("static/build"));

// require('os').homedir();
let baseDir = path.join(__dirname, "/.diodefaucet");
let queueDir = path.join(baseDir, "/queue");
let exceptionsDir = path.join(baseDir, "/exceptions");
mkdirp.sync(queueDir);
mkdirp.sync(exceptionsDir);
const dbQueue = level(queueDir);
const dbExceptions = level(
  exceptionsDir
);
const greylistduration = 1000 * 60 * 60 * 24;

const dev = process.env.NODE_ENV === "development";
let account;
let web3;
let pk;
let wallet;

// check for valid Eth address
function isAddress(address) {
  return /^0x[a-f\d]{40}$/i.test(address);
}

// Add 0x to address
function fixaddress(address) {
  // Strip all spaces
  address = address.replace(" ", "");
  // Address lowercase
  address = address.toLowerCase();
  //console.log("Fix address", address);
  if (!strStartsWith(address, "0x")) {
    return "0x" + address;
  }
  return address.toLowerCase();
}

function strStartsWith(str, prefix) {
  return str.indexOf(prefix) === 0;
}

// const options = {
// 	cert: fs.readFileSync('./sslcert/fullchain.pem'),
// 	key: fs.readFileSync('./sslcert/privkey.pem')
// };
// https.createServer(options, app).listen(443);

// =======================
// Promise wrapper for some functions in web3
// Get faucet balance in ether ( or other denomination if given )
function getFaucetBalance(denomination) {
  return parseFloat(
    web3.fromWei(
      web3.eth.getBalance(account).toNumber(),
      denomination || "ether"
    )
  );
}

function getGasPrice() {
  return new Promise((resolve, reject) => {
    web3.eth.getGasPrice(function(err, gasPrice) {
      if (err) {
        reject(err);
      } else {
        resolve(gasPrice.toNumber(10));
      }
    });
  });
}

function getNonce(address) {
  return new Promise((resolve, reject) => {
    web3.eth.getTransactionCount(account, function(err, nonce) {
      if (err) {
        reject(err);
      } else {
        resolve(nonce);
      }
    });
  })
}

function sendRawTransaction(serializedTx) {
  return new Promise((resolve, reject) => {
    web3.eth.sendRawTransaction(serializedTx, function(err, txHash) {
      if (err) {
        reject(err);
      } else {
        resolve(txHash);
      }
    });
  })
}
// =======================

// get current faucet info
app.get("/faucetinfo", function(req, res) {
  let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log("client IP=", ip);
  let etherbalance = -1;
  etherbalance = getFaucetBalance();
  res.status(200).json({
    account: account,
    balance: etherbalance,
    etherscanroot: config.etherscanroot,
    payoutfrequencyinsec: config.payoutfrequencyinsec,
    payoutamountinether: config.payoutamountinether,
    queuesize: config.queuesize,
    queuename: "queue"
  });
});

// =======================
// need to add admin user?
// app.get("/blacklist/:address", function(req, res) {
//   var address = fixaddress(req.params.address);
//   if (isAddress(address)) {
//     setException(address, "blacklist").then(() => {
//       res.status(200).json({
//         msg: "address added to blacklist"
//       });
//     });
//   } else {
//     return res.status(400).json({
//       message: "the address is invalid"
//     });
//   }
// });

// app.get("/q", function(req, res) {
//   getQueue().then(q => {
//     res.status(200).json(q);
//   });
// });

// function getQueue() {
//   var q = [];
//   return new Promise((resolve, reject) => {
//     var stream = dbQueue
//       .createReadStream({
//         keys: true,
//         values: true
//       })
//       .on("data", item => {
//         q.push(item);
//       })
//       .on("end", function() {
//         resolve(q);
//       });
//   });
// }

// function exceptionsLength() {
//   return new Promise((resolve, reject) => {
//     var lengths = {};
//     dbExceptions
//       .createReadStream({
//         keys: true,
//         values: true
//       })
//       .on("data", function(item) {
//         var data = JSON.parse(item.value);
//         if (!lengths[data.reason]) {
//           lengths[data.reason] = 0;
//         }
//         lengths[data.reason]++;
//       })
//       .on("error", function(err) {
//         reject(err);
//       })
//       .on("end", function() {
//         resolve(lengths);
//       });
//   });
// }
// =======================

let lastIteration = 0;

function canDonateNow() {
  return new Promise((resolve, reject) => {
    const res = lastIteration < Date.now() - config.payoutfrequencyinsec * 1000;
    if (!res) {
      resolve(false);
    } else {
      queueLength().then(length => {
        resolve(length == 0);
      });
    }
  });
}

function setDonatedNow() {
  lastIteration = Date.now();
  console.log("last donation:", lastIteration);
}

async function doDonation(address) {
  // return new Promise((resolve, reject) => {
  setDonatedNow();
  let txHash = await donate(address);
  return txHash;
  // });
}

function queueLength() {
  return new Promise((resolve, reject) => {
    var count = 0;
    dbQueue
      .createReadStream()
      .on("data", function(data) {
        count++;
      })
      .on("error", function(err) {
        reject(err);
      })
      .on("end", function() {
        resolve(count);
      });
  });
}

function enqueueRequest(address) {
  return new Promise((resolve, reject) => {
    const key = Date.now() + "-" + address;
    dbQueue.put(
      key,
      JSON.stringify({
        created: Date.now(),
        address: address
      }),
      function(err) {
        if (err) {
          return reject(err);
        }
        queueLength().then(length => {
          // calculated estimated payout date
          return resolve(
            Date.now() + length * config.payoutfrequencyinsec * 1000
          );
        });
      }
    );
  });
}

function iterateQueue() {
  return new Promise((resolve, reject) => {
    // make sure faucet does not drip too fast.
    if (canDonateNow()) {
      var stream = dbQueue
        .createReadStream({
          keys: true,
          values: true
        })
        .on("data", item => {
          console.log("item:", item);
          stream.destroy();
          dbQueue.del(item.key, err => {
            if (err) {
              ///
            }
            var data = JSON.parse(item.value);
            console.log("DONATE TO ", data.address);
            setDonatedNow();
            doDonation(data.address).then(txhash => {
              console.log("sent ETH to ", data.address);
              return resolve();
            });
          });
        });
    } else {
      return resolve();
    }
  });
}

// lookup if there is an exception made for this address
function getException(address) {
  return new Promise((resolve, reject) => {
    dbExceptions.get(address, function(err, value) {
      if (err) {
        if (err.notFound) {
          // handle a 'NotFoundError' here
          return resolve();
        }
        // I/O or other error, pass it up the callback chain
        return reject(err);
      }
      value = JSON.parse(value);
      resolve(value);
    });
  });
}

// set an exception for this address ( greylist / blacklist )
function setException(address, reason) {
  return new Promise((resolve, reject) => {
    dbExceptions.put(
      address,
      JSON.stringify({
        created: Date.now(),
        reason: reason,
        address: address
      }),
      function(err) {
        if (err) {
          return reject(err);
        }
        resolve();
      }
    );
  });
}

// check if there are items in the exception queue that need to be cleaned up.
function cleanupException() {
  var stream = dbExceptions
    .createReadStream({
      keys: true,
      values: true
    })
    .on("data", item => {
      const value = JSON.parse(item.value);
      if (value.reason === "greylist") {
        if (value.created < Date.now() - greylistduration) {
          dbExceptions.del(item.key, err => {
            console.log("removed ", item.key, "from greylist");
          });
        }
      }
    });
}

// check the tweet
function checkTweet(id, text) {
  return new Promise((resolve, reject) => {
    twitterClient.get('statuses/show/' + id, function (err, tweet) {
      if (err) {
        return reject(err);
      }
      if (tweet.text !== text) {
        return reject(new Error('Wrong tweet text'));
      }
      resolve();
    });
  });
}

// try to add an address to the donation queue
app.post("/donate", function(req, res) {
  let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  ip = ip.replace(/\./g, "_");
  let address = fixaddress(req.body.address);
  let tweetUrl = req.body.tweetUrl;
  if (!isAddress(address)) {
    return res.status(400).json({
      message: "the address is invalid"
    });
  }
  let twitterUrl = Url.parse(tweetUrl);
  if (twitterUrl.host !== 'twitter.com') {
    return res.status(400).json({
      message: "tweet url is invalid"
    });
  }
  let regex = /^\/([\w\d_]+)\/status\/([\d]+)$/;
  let parsed = regex.exec(twitterUrl.path);

  if (!parsed || parsed.length !== 3) {
    return res.status(400).json({
      message: "tweet url is invalid"
    });
  }
  const id = parsed[2];
  const text = `Requesting faucet funds 0.2 diode into ${address} on the #diode_chain test network.`;
  // const key = Date.now() + "-" + address;
  // const val = {
  //   address: address
  // };
  Promise.all([getException(address), getException(ip), getException(id)]).then(
    ([addressException, ipException, idException]) => {
      var exception = addressException || ipException || idException;
      if (exception) {
        if (exception.reason === "greylist") {
          console.log(exception.address, "is on the greylist");
          return res.status(403).json({
            address: exception.address,
            message: "you are greylisted",
            duration: exception.created + greylistduration - Date.now()
          });
        }
        if (exception.reason === "blacklist") {
          console.log(exception.address, "is on the blacklist");
          return res.status(403).json({
            address: address,
            message: "you are blacklisted"
          });
        }
      } else {
        checkTweet(id, text)
          .then(() => {
            return canDonateNow();
          })
          .then(canDonate => {
            if (canDonate) {
              // donate right away
              console.log("donating now to:", address);
              doDonation(address)
                .then(txhash => {
                  Promise.all([
                    setException(id, "greylist"),
                    setException(ip, "greylist"),
                    setException(address, "greylist")
                  ]).then(() => {
                    var reply = {
                      address: address,
                      txhash: txhash,
                      amount: config.payoutamountinether * 1e18
                    };
                    return res.status(200).json(reply);
                  });
                })
                .catch(e => {
                  Promise.all([
                    setException(id, "greylist"),
                    setException(ip, "greylist"),
                    setException(address, "greylist")
                  ]).then(() => {
                    return res.status(500).json({
                      address: address,
                      message: "Cannot donate to the address, please tell us"
                    });
                  });
                });
            } else {
              // queue item
              console.log("adding address to queue:", address);
              queueLength().then(length => {
                if (length < config.queuesize) {
                  enqueueRequest(address).then(paydate => {
                    console.log("request queued for", address);
                    Promise.all([
                      setException(id, "greylist"),
                      setException(ip, "greylist"),
                      setException(address, "greylist")
                    ]).then(() => {
                      var queueitem = {
                        paydate: paydate,
                        address: address,
                        amount: config.payoutamountinether * 1e18
                      };
                      return res.status(200).json(queueitem);
                    });
                  });
                } else {
                  return res.status(403).json({
                    msg: "queue is full"
                  });
                }
              });
            }
          })
          .catch((err) => {
            return res.status(400).json({
              address: address,
              message: err.message
            });
          });
      }
    }
  );
});

async function donate(to) {
  let gasPrice = await getGasPrice();
  console.log("gasprice is ", gasPrice);

  let amount = config.payoutamountinether * 1e18;
  let nonce = await getNonce(account);
  console.log("Transferring ", amount, "wei from", account, "to", to);
  let options = {
    gasPrice: gasPrice,
    gasLimit: 3000000,
    gas: 3000000,
    data: "",
    to: to,
    nonce: nonce,
    value: amount
  };
  let tx = new EthereumTx(options);
  tx.sign(pk);
  let txHash = await sendRawTransaction(`0x${tx.serialize().toString('hex')}`);
  console.log("Transaction Successful!");
  console.log(txHash);
  return txHash;
}

app.use(function (err, req, res, next) {
  console.log("Error: " + err.message);
  let json = (dev) ? { error: err.message } : { error: "Internal server error"};
  return res.status(500).json(json);
});

const faucetWallet = JSON.stringify(require(config.wallet.filename));
wallet = Ethwallet.fromV3(faucetWallet, config.wallet.password);
pk = wallet.getPrivateKey();
account = fixaddress(wallet.getAddressString());
console.log("Faucet address: " + wallet.getAddressString());
console.log("Connecting to ETH node: ", config.web3.host);

let web3Provider = new Web3.providers.HttpProvider(config.web3.host);
web3 = new Web3();
web3.setProvider(web3Provider);

// start webserver...
app.listen(config.httpport, function() {
  console.log("Faucet listening on port ", config.httpport);
});

// queue monitor
setInterval(() => {
  iterateQueue();
  cleanupException();
}, config.payoutfrequencyinsec * 1000);