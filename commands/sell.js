import colors from 'colors';
import minimist from 'minimist';
import n from 'numbro';
import engineFactory from '../lib/engine.js';
import objectifySelector from '../lib/objectify-selector.js';
// import _ from 'lodash';

export default (program, conf) => {
  colors.enable();

  program
    .command('sell [selector]')
    .allowUnknownOption()
    .description('execute a sell order to the exchange')
    .option('--pct <pct>', 'sell with this % of currency balance', Number, conf.sell_pct)
    .option('--order_type <type>', 'order type to use (maker/taker)', /^(maker|taker)$/i, conf.order_type)
    .option('--size <size>', 'sell specific size of currency')
    .option('--markup_sell_pct <pct>', '% to mark up sell price', Number, conf.markup_sell_pct)
    .option('--order_adjust_time <ms>', 'adjust ask on this interval to keep order competitive', Number, conf.order_adjust_time)
    .option('--order_poll_time <ms>', 'poll order status on this interval', Number, conf.order_poll_time)
    .option('--max_slippage_pct <pct>', 'avoid selling at a slippage pct above this float', conf.max_slippage_pct)
    .option('--debug', 'output detailed debug info')
    .action(async (selector, cmd) => {
      let s = { options: minimist(process.argv) };
      let so = s.options;
      delete so._;
      Object.keys(conf).forEach(function (k) {
        if (typeof cmd[k] !== 'undefined') {
          so[k] = cmd[k];
        }
      });
      so.debug = cmd.debug;
      so.sell_pct = cmd.pct;
      so.selector = objectifySelector(selector || conf.selector);
      let order_types = ['maker', 'taker'];
      if (!order_types.includes(so.order_type)) {
        so.order_type = 'maker';
      }
      so.mode = 'live';
      so.strategy = conf.strategy;
      so.stats = true;
      let engine = await engineFactory(s, conf);
      let result = await engine.executeSignal('sell', cmd.size);
      let err = result.err;
      let order = result.data;
      if (result.err) {
        console.error(err);
        process.exit(1);
      }
      if (!order) {
        console.error('not enough asset balance to sell!');
        process.exit(1);
      }

      // check order every order_poll_time
      let checkOrder = async () => {
        if (s.api_order) {
          let result = await s.exchange.getQuote({ product_id: s.product_id });
          let err = result.err;
          let quote = result.data;
          if (err) {
            throw err;
          }
          console.log(
            'order status: '.grey +
              s.api_order.status.green +
              ', ask: '.grey +
              n(s.api_order.price).format('0.00000000').yellow +
              ', '.grey +
              n(s.api_order.price).subtract(quote.ask).format('0.00000000').red +
              ' above best ask, '.grey +
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
