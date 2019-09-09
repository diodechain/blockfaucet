let help = function () {
  this.exec = function () {
    console.log("Faucet v0.0.1 - a development program for Diode\n");
    console.log("Usage: [command] <parameters>...\nCommand:");
    console.log("  mkwallet:\n  mkwallet <password> <fileName>");
    console.log("  rdwallet:\n  rdwallet <password> <fileName>");
  }

  return this;
}

module.exports = help;