const Ethwallet = require("ethereumjs-wallet");
const PasswordPolicy = require("password-sheriff").PasswordPolicy;
const policy = new PasswordPolicy({
  length: {
    minLength: 3
  },
  identicalChars: {
    max: 2
  }
});
const util = require("util");
const fs = require("fs");

let rdwallet = function () {
  this.helpText = function () {
    return "Usage of rdwallet:\nrdwallet <password> <fileName>";
  }

  this.exec = function () {
    if (arguments.length !== 2) {
      return console.log(this.helpText());
    }
    let password = arguments[0];
    let fileName = arguments[1];
    const serializedWallet = JSON.stringify(require(fileName));
    const wallet = Ethwallet.fromV3(serializedWallet, password);
    return wallet.getAddressString();
  }

  return this;
}

module.exports = rdwallet;