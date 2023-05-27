/* eslint-disable no-undef */
import axios from 'axios';
import ccxt from 'ccxt';
import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import bk from 'node-bitbankcc';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export default conf => {
  let public_client, authed_client;
  let __dirname = dirname(fileURLToPath(import.meta.url));

  let publicClient = () => {
    if (!public_client) public_client = new ccxt.bitbank({ apiKey: '', secret: '' });
    return public_client;
  };

  let authedClient = () => {
    if (!authed_client) {
      if (!conf.bitbank || !conf.bitbank.key || conf.bitbank.key === 'YOUR-API-KEY') {
        throw new Error('please configure your Bitbank credentials in ' + path.resolve(__dirname, 'conf.js'));
      }
      authed_client = new ccxt.bitbank({
        apiKey: conf.bitbank.key,
        secret: conf.bitbank.secret,
      });
    }
    return authed_client;
  };

  /**
   * Convert XXX-XXX to XXX/XXX
   *
   * @param product_id XXX-XXX
   * @returns {string}
   */
  let joinProduct = product_id => {
    let split = product_id.split('-');
    return split[0] + '/' + split[1];
  };

  /**
   * Convert XXX-XXX to XXX_XXX
   *
   * @param product_id XXX_XXX
   * @returns {string}
   */
  let joinProductWithUnderBar = product_id => {
    let split = product_id.split('-');
    return split[0] + '_' + split[1];
  };

  let retry = (method, args, error) => {
    if (method !== 'getTrades') {
      console.error(('\nBitbank API is down! unable to call ' + method + ', retrying in 20s').red);
      if (error) console.error(error);
      console.error(args.slice(0, -1));
    }
    setTimeout(() => {
      exchange[method].apply(exchange, args);
    }, 20000);
  };

  let orders = {};

  let roundToNearest = async (numToRound, opts) => {
    let numToRoundTo = _.find(await getProducts(), {
      asset: opts.product_id.split('-')[0],
      currency: opts.product_id.split('-')[1],
    }).min_size;
    numToRoundTo = 1 / numToRoundTo;

    return Math.floor(numToRound * numToRoundTo) / numToRoundTo;
  };

  let getProducts = async () => {
    let products = await JSON.parse(fs.readFileSync(path.resolve(__dirname, 'products.json')));
    return products;
  };

  let exchange = {
    name: 'bitbank',
    historyScan: 'forward',
    historyScanUsesTime: true,
    makerFee: -0.02,
    takerFee: 0.12,
    backfillRateLimit: 100, //just for safe

    getProducts: getProducts,
    roundToNearest: roundToNearest,
    getTrades: async opts => {
      let func_args = [opts];
      let startTime = null;
      let args = {};
      if (opts.from) {
        startTime = opts.from;
      } else {
        startTime = parseInt(opts.to, 10) - 3600000;
        args['endTime'] = opts.to;
      }

      const symbol = joinProduct(opts.product_id);
      let fulldate = moment(startTime).format('YYYYMMDD');
      let result;
      let newtrades = [];

      try {
        let url = 'https://public.bitbank.cc/' + symbol.toLowerCase().replace('/', '_') + '/transactions/' + fulldate;
        result = await axios.get(url);
        let trades = result.data.data.transactions.map(trade => ({
          trade_id: trade.transaction_id,
          time: trade.executed_at,
          size: parseFloat(trade.amount),
          price: parseFloat(trade.price),
          side: trade.side,
        }));
        for (let i = 0; i < trades.length; i++) {
          if (trades[i].time > startTime) {
            newtrades.push(trades[i]);
          }
        }
      } catch (err) {
        if (err.code === 'ERR_BAD_REQUEST') {
          // let current_date = mode === 'backward' ? new Date(marker.oldest_time - 86400000).toISOString() : new Date(marker.newest_time + 86400000).toISOString();
          // console.log('\nthere is no data on', current_date.split('T')[0].red, '.');
          return newtrades;
        } else throw err;
      }

      return newtrades;
    },

    getBalance: async opts => {
      let func_args = [opts];
      let client = authedClient();
      let result;
      try {
        result = await client.fetchBalance();
      } catch (error) {
        return retry('getBalance', func_args, null);
      }
      let balance = { asset: 0, currency: 0 };
      Object.keys(result).forEach(key => {
        if (key === opts.currency) {
          balance.currency = result[key].free + result[key].used;
          balance.currency_hold = result[key].used;
        }
        if (key === opts.asset) {
          balance.asset = result[key].free + result[key].used;
          balance.asset_hold = result[key].used;
        }
      });

      // balance
      // {
      //   asset: 0.0003,
      //   currency: 77856.3852,
      //   currency_hold: 0,
      //   asset_hold: 0,
      // }

      return {
        err: null,
        data: balance,
      };
    },

    getQuote: async opts => {
      let func_args = [opts];
      let client = publicClient();
      let result;

      try {
        result = await client.fetchTicker(joinProduct(opts.product_id));
      } catch (err) {
        return retry('getQuote', func_args, null);
      }

      // {
      //   symbol: "BTC/JPY",
      //   timestamp: 1684045580153,
      //   datetime: "2023-05-14T06:26:20.153Z",
      //   high: 3677886,
      //   low: 3612558,
      //   bid: 3651025,
      //   bidVolume: undefined,
      //   ask: 3651026,
      //   askVolume: undefined,
      //   vwap: undefined,
      //   open: undefined,
      //   close: 3650000,
      //   last: 3650000,
      //   previousClose: undefined,
      //   change: undefined,
      //   percentage: undefined,
      //   average: undefined,
      //   baseVolume: 105.6726,
      //   quoteVolume: undefined,
      //   info: {
      //     sell: "3651026",
      //     buy: "3651025",
      //     open: "3638804",
      //     high: "3677886",
      //     low: "3612558",
      //     last: "3650000",
      //     vol: "105.6726",
      //     timestamp: "1684045580153",
      //   },
      // }

      return {
        err: null,
        data: { bid: result.bid, ask: result.ask },
      };
    },

    getDepth: async opts => {
      let func_args = [opts];
      let client = publicClient();
      let result;

      try {
        result = await client.fetchOrderBook(joinProduct(opts.product_id), { limit: opts.limit });
      } catch (err) {
        return retry('getDepth', func_args, null);
      }

      return {
        err: null,
        data: result,
      };
    },

    cancelOrder: async opts => {
      let func_args = [opts];
      let client = authedClient();
      let result;

      try {
        result = await client.cancelOrder(opts.order_id, joinProduct(opts.product_id));
        // {
        //   order_id: "28842850767",
        //   pair: "btc_jpy",
        //   side: "sell",
        //   type: "limit",
        //   start_amount: "0.0217",
        //   remaining_amount: "0.0217",
        //   executed_amount: "0.0000",
        //   price: "3727001",
        //   average_price: "0",
        //   ordered_at: "1683613055133",
        //   canceled_at: "1683613116551",
        //   status: "CANCELED_UNFILLED",
        //   expire_at: "1699165055133",
        //   post_only: true,
        // }
        if (result && result.status === 'CANCELED_UNFILLED') {
          return { err: null, data: result };
        }
      } catch (err) {
        // decide if this error is allowed for a retry
        if (!err.message.match('50026')) {
          // retry is allowed for this error
          return retry('cancelOrder', func_args, err);
        }
        return { err: null, data: null };
      }
      return { err: null, data: result };
    },

    // test OK
    buy: async opts => {
      let func_args = [opts];
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true;
      }
      opts.type = 'limit';
      let args = {};
      if (opts.order_type === 'taker') {
        delete opts.post_only;
        opts.type = 'market';
      } else {
        args.timeInForce = 'GTC';
      }
      opts.side = 'buy';
      delete opts.order_type;
      let order = {};

      const bitbankConf = {
        endPoint: 'https://api.bitbank.cc/v1', // required
        apiKey: conf.bitbank.key, // required
        apiSecret: conf.bitbank.secret, // required
        keepAlive: false, // optional, default->false
        timeout: 3000, // optional, default->3000
      };
      let privateApi = new bk.PrivateApi(bitbankConf);

      let params = {
        pair: joinProductWithUnderBar(opts.product_id).toLowerCase(), // required
        amount: await roundToNearest(opts.size, opts), // required
        price: opts.price, // optional
        side: opts.side, // required
        type: opts.type, // required
        post_only: opts.post_only, // optional
      };

      let result;
      try {
        result = await privateApi.postOrder(params);
        // {
        //   success: 1,
        //   data: {
        //     order_id: 28853764001,
        //     pair: "btc_jpy",
        //     side: "buy",
        //     type: "limit",
        //     start_amount: "0.0212",
        //     remaining_amount: "0.0212",
        //     executed_amount: "0.0000",
        //     price: "3745168",
        //     average_price: "0",
        //     ordered_at: 1683675850747,
        //     status: "UNFILLED",
        //     expire_at: 1699227850747,
        //     post_only: true,
        //   },
        // };
      } catch (err) {
        if (err.message.match('60001')) {
          return {
            err: null,
            data: {
              status: 'rejected',
              reject_reason: 'balance',
            },
          };
        }

        return retry('buy', func_args, null);
      }

      order = {
        id: result ? result.data.order_id : null,
        status: 'open',
        price: opts.price,
        size: await roundToNearest(opts.size, opts),
        post_only: !!opts.post_only,
        created_at: new Date().getTime(),
        filled_size: '0',
        ordertype: opts.order_type,
      };
      orders['~' + result.data.order_id] = order;

      return {
        err: null,
        data: order,
      };
    },

    sell: async opts => {
      let func_args = [opts];
      if (typeof opts.post_only === 'undefined') {
        opts.post_only = true;
      }
      opts.type = 'limit';
      let args = {};
      if (opts.order_type === 'taker') {
        delete opts.post_only;
        opts.type = 'market';
      } else {
        args.timeInForce = 'GTC';
      }
      opts.side = 'sell';
      delete opts.order_type;
      let order = {};

      const bitbankConf = {
        endPoint: 'https://api.bitbank.cc/v1', // required
        apiKey: conf.bitbank.key, // required
        apiSecret: conf.bitbank.secret, // required
        keepAlive: false, // optional, default->false
        timeout: 3000, // optional, default->3000
      };
      let privateApi = new bk.PrivateApi(bitbankConf);

      let params = {
        pair: joinProductWithUnderBar(opts.product_id).toLowerCase(), // required
        amount: await roundToNearest(opts.size, opts), // required
        price: opts.price, // optional
        side: opts.side, // required
        type: opts.type, // required
        post_only: opts.post_only, // optional
      };

      let result;
      try {
        result = await privateApi.postOrder(params);
        // result
        // {
        //   success: 1,
        //   data: {
        //     order_id: 28833008974,
        //     pair: "btc_jpy",
        //     side: "sell",
        //     type: "limit",
        //     start_amount: "0.0002",
        //     remaining_amount: "0.0002",
        //     executed_amount: "0.0000",
        //     price: "3791973",
        //     average_price: "0",
        //     ordered_at: 1683542118646,
        //     status: "UNFILLED",
        //     expire_at: 1699094118646,
        //     post_only: true,
        //   },
        // }
      } catch (err) {
        if (error.message.match('60001')) {
          return {
            err: null,
            data: {
              status: 'rejected',
              reject_reason: 'balance',
            },
          };
        }
        return retry('sell', func_args, null);
      }

      order = {
        id: result ? result.data.order_id : null,
        status: 'open',
        price: opts.price,
        size: await roundToNearest(opts.size, opts),
        post_only: !!opts.post_only,
        created_at: new Date().getTime(),
        filled_size: '0',
        ordertype: opts.order_type,
      };
      orders['~' + result.data.order_id] = order;

      return { err: null, data: order };
    },

    getOrder: async opts => {
      let func_args = [opts];
      let client = authedClient();
      let order = orders['~' + opts.order_id];
      let result;

      try {
        result = await client.fetchOrder(opts.order_id, joinProduct(opts.product_id));
      } catch (err) {
        return retry('getOrder', func_args, err);
      }

      if (result.status !== 'open' && result.status !== 'canceled') {
        order.status = 'done';
        order.done_at = new Date().getTime();
        order.price = parseFloat(result.price);
        order.filled_size = parseFloat(result.amount) - parseFloat(result.remaining);
        return { err: null, data: order };
      }
      return { err: null, data: order };
    },

    getCursor: trade => {
      return trade.time || trade;
    },
  };
  return exchange;
};
