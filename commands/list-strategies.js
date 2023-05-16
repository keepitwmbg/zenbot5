import colors from 'colors';
import fs from 'fs';

export default (program, conf) => {
  colors.enable();

  program
    .command('list-strategies')
    .description('list available strategies')
    .action(async (/*cmd*/) => {
      let strategies = fs.readdirSync('./extensions/strategies');
      for (let strategy of strategies) {
        let strat = (await import(`../extensions/strategies/${strategy}/strategy.js`)).default;
        console.log(strat.name.cyan + (strat.name === conf.strategy ? ' (default)'.grey : ''));
        if (strat.description) {
          console.log('  description:'.grey);
          console.log('    ' + strat.description.grey);
        }
        console.log('  options:'.grey);
        let ctx = {
          option: function (name, desc, type, def) {
            console.log(('    --' + name).green + '=<value>'.grey + '  ' + desc.grey + (typeof def !== 'undefined' ? ' (default: '.grey + def + ')'.grey : ''));
          },
        };
        strat.getOptions.call(ctx, strat);
        console.log();
      }
      process.exit();
    });
};
