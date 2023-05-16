import colors from 'colors';
import minimist from 'minimist';
import moment from 'moment';
import n from 'numbro';
import { formatCurrency } from '../lib/format.js';
import exchangeService from '../lib/services/exchange-service.js';

export default (program, conf) => {
  colors.enable();

  program
    .command('balance [selector]')
    .allowUnknownOption()
    .description('get asset and currency balance from the exchange')
    //.option('--all', 'output all balances')
    .option('-c, --calculate_currency <calculate_currency>', 'show the full balance in another currency')
    .option('--debug', 'output detailed debug info')
    .action(async (selector, cmd) => {
      if (selector !== undefined) conf.selector = selector;

      let exchangeServiceInstance = exchangeService(conf);
      selector = exchangeServiceInstance.getSelector();

      let s = {
        options: minimist(process.argv),
        selector: selector,
        product_id: selector.product_id,
        asset: selector.asset,
        currency: selector.currency,
      };

      let so = s.options;
      delete so._;

      Object.keys(conf).forEach(function (k) {
        if (typeof cmd[k] !== 'undefined') {
          so[k] = cmd[k];
        }
      });
      so.selector = s.selector;
      so.debug = cmd.debug;
      so.mode = 'live';

      let exchange = await exchangeServiceInstance.getExchange();

      if (exchange === undefined) {
        console.error("\nSorry, couldn't find an exchange from selector [" + conf.selector + '].');
        process.exit(1);
      }

      let result = await exchange.getBalance(s);
      let err = result.err;
      if (err) throw err;
      let balance = result.data;

      let resultQuote = await exchange.getQuote(s);
      let errq = resultQuote.err;
      if (errq) throw errq;
      let quote = resultQuote.data;

      let bal = moment().format('YYYY-MM-DD HH:mm:ss').grey + ' ' + formatCurrency(quote.ask, s.currency, true, true, false) + ' ' + s.product_id.grey + '\n';
      bal +=
        moment().format('YYYY-MM-DD HH:mm:ss').grey +
        ' Asset: '.grey +
        n(balance.asset).format('0.00000000').white +
        ' Available: '.grey +
        n(balance.asset).subtract(balance.asset_hold).value().toString().yellow +
        '\n';
      bal += moment().format('YYYY-MM-DD HH:mm:ss').grey + ' Asset Value: '.grey + n(balance.asset).multiply(quote.ask).value().toString().white + '\n';
      bal +=
        moment().format('YYYY-MM-DD HH:mm:ss').grey +
        ' Currency: '.grey +
        n(balance.currency).format('0.00000000').white +
        ' Available: '.grey +
        n(balance.currency).subtract(balance.currency_hold).value().toString().yellow +
        '\n';
      bal += moment().format('YYYY-MM-DD HH:mm:ss').grey + ' Total: '.grey + n(balance.asset).multiply(quote.ask).add(balance.currency).value().toString().white;
      console.log(bal);

      if (so.calculate_currency) {
        let result = await exchange.getQuote({ product_id: s.asset + '-' + so.calculate_currency });
        let err = result.err;
        if (err) throw err;
        let asset_quote = result.quote;

        let resultq = await exchange.getQuote({ product_id: s.currency + '-' + so.calculate_currency });
        let errq = resultq.err;
        if (errq) throw errq;
        let currency_quote = resultq.quote;
        var asset_total = balance.asset * asset_quote.bid;
        var currency_total = balance.currency * currency_quote.bid;
        console.log((so.calculate_currency + ': ').grey + (asset_total + currency_total));
        process.exit();
      } else {
        process.exit();
      }
    });
};
