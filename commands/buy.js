import colors from 'colors';
import _ from 'lodash';
import minimist from 'minimist';
import n from 'numbro';
import engineFactory from '../lib/engine.js';
import objectifySelector from '../lib/objectify-selector.js';

export default (program, conf) => {
  colors.enable();

  program
    .command('buy [selector]')
    .allowUnknownOption()
    .description('execute a buy order to the exchange')
    .option('--pct <pct>', 'buy with this % of currency balance', Number, conf.buy_pct)
    .option('--order_type <type>', 'order type to use (maker/taker)', /^(maker|taker)$/i, conf.order_type)
    .option('--size <size>', 'buy specific size of currency')
    .option('--markdown_buy_pct <pct>', '% to mark down buy price', Number, conf.markdown_buy_pct)
    .option('--order_adjust_time <ms>', 'adjust bid on this interval to keep order competitive', Number, conf.order_adjust_time)
    .option('--order_poll_time <ms>', 'poll order status on this interval', Number, conf.order_poll_time)
    .option('--max_slippage_pct <pct>', 'avoid buying at a slippage pct above this float', conf.max_slippage_pct)
    .option('--debug', 'output detailed debug info')
    .action(async function (selector, cmd) {
      let s = { options: minimist(process.argv) };
      let so = s.options;
      delete so._;
      Object.keys(conf).forEach(function (k) {
        if (typeof cmd[k] !== 'undefined') {
          so[k] = cmd[k];
        }
      });
      so.debug = cmd.debug;
      so.buy_pct = cmd.pct;
      so.selector = objectifySelector(selector || conf.selector);
      let order_types = ['maker', 'taker'];
      if (!order_types.includes(so.order_type)) {
        so.order_type = 'maker';
      }
      so.mode = 'live';
      so.strategy = conf.strategy;
      so.stats = true;
      let engine = await engineFactory(s, conf);

      // execute buy
      let result = await engine.executeSignal('buy', cmd.size);
      let err = result.err;
      let order = result.data;
      if (err) {
        console.error(err);
        process.exit(1);
      }
      if (!order) {
        console.error('not enough currency balance to buy!');
        process.exit(1);
      }

      // check order every order_poll_time
      let checkOrder = async () => {
        if (s.api_order && !_.isEmpty(s.api_order)) {
          let result = await s.exchange.getQuote({ product_id: s.product_id });
          let err = result.err;
          let quote = result.data;
          if (err) {
            throw err;
          }
          console.log(
            'order status: '.grey +
              s.api_order.status.green +
              ', bid: '.grey +
              n(s.api_order.price).format('0.00000000').yellow +
              ', '.grey +
              n(quote.bid).subtract(s.api_order.price).format('0.00000000').red +
              ' below best bid, '.grey +
              n(s.api_order.filled_size).divide(s.api_order.size).format('0.0%').green +
              ' filled'.grey
          );
          if (s.api_order.status === 'done') {
            process.exit();
          }
        } else {
          console.log('placing order...');
        }
      };
      setInterval(checkOrder, conf.order_poll_time);
    });
};
