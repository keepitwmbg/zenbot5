import colors from 'colors';
import fs from 'fs';

export default program => {
  colors.enable();

  program
    .command('list-selectors')
    .description('list available selectors')
    .action((/*cmd*/) => {
      var exchanges = fs.readdirSync('./extensions/exchanges');
      exchanges.forEach(exchange => {
        if (exchange === 'sim' || exchange === '_stub') return;

        console.log(`${exchange}:`);
        let products = JSON.parse(fs.readFileSync(`./extensions/exchanges/${exchange}/products.json`));
        products.sort((a, b) => {
          if (a.asset < b.asset) return -1;
          if (a.asset > b.asset) return 1;
          if (a.currency < b.currency) return -1;
          if (a.currency > b.currency) return 1;
          return 0;
        });
        products.forEach(function (p) {
          console.log('  ' + exchange.cyan + '.'.grey + p.asset.green + '-'.grey + p.currency.cyan + (p.label ? ('   (' + p.label + ')').grey : ''));
        });
      });
      process.exit();
    });
};
