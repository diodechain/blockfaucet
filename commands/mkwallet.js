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

let mkwallet = function () {
  this.helpText = function () {
    return "Usage of mkwallet:\nmkwallet <password> <fileName>";
  }

  this.getRules = function () {
    let rules = policy.explain();
    let rmsg = [];
    rules.forEach((rule) => {
      let msg = "";
      if (rule.format.length === 1) {
        msg = util.format(rule.message, rule.format[0]);
      } else if (rule.format.length === 2) {
        msg = util.format(rule.message, rule.format[0], rule.format[1]);
      }
      rmsg.push(msg);
    });
    return rmsg;
  }
  
  this.validate = function (password, fileName) {
    let isValid = policy.check(password);
    return isValid;
  }

  this.exec = function () {
    if (arguments.length !== 2) {
      return console.log(this.helpText());
    }
    let password = arguments[0];
    let fileName = arguments[1];
    if (this.validate(password, fileName) === false) {
      rules = this.getRules();
      throw new Error("password must be\n" + rules.join("\n"));
    }
    let wallet = Ethwallet.generate();
    let v3 = wallet.toV3String(password);
    console.log("Create wallet: " + wallet.getAddressString() + "\nStart to write to file: " + fileName);
    fs.writeFileSync(fileName, v3);
    console.log("Wallet saved");
  }

  return this;
}

module.exports = mkwallet;