const repl = require('repl');
const mkwallet = require('./commands/mkwallet');
const rdwallet = require('./commands/rdwallet');
const help = require('./commands/help');
const commands = {
  mkwallet: new mkwallet(),
  rdwallet: new rdwallet(),
  help: new help()
};

function faucetProcessor (cmd) {
  console.log("Please do not generate wallet on remote machine");
  let parsedCmd = cmd.trim().split(' ');
  let ctx = commands[parsedCmd.splice(0,1)];
  if (typeof ctx === 'undefined') {
    return commands.help.exec.call(ctx, ...parsedCmd);
  }
  return ctx.exec.call(ctx, ...parsedCmd);
}

function faucetEval(cmd, context, filename, callback) {
  callback(null, faucetProcessor(cmd));
}

repl.start({
  prompt: '$ ',
  mode: 'strict',
  eval: faucetEval
});