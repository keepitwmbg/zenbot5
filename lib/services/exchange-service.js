import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import objectifySelector from '../objectify-selector.js';

export default conf => {
  // ASSUMES c.selector has been set, for example, with whatever command line parameters there may have been.
  //  Not that this class would know anything about command line parameters. It just assumes.
  let selector = objectifySelector(conf.selector);

  let theService = {};

  theService.BACKWARD = 'backward';
  theService.FORWARD = 'forward';

  let _getExchange = async exchangeId => {
    if (exchangeId === undefined) {
      exchangeId = selector.exchange_id;
    }
    const __dirname = dirname(fileURLToPath(import.meta.url));
    let ex = await import(path.resolve(__dirname, `../../extensions/exchanges/${exchangeId}/exchange.js`));
    return ex.default(conf);
  };

  theService.getExchange = async exchangeId => {
    return await _getExchange(exchangeId);
  };

  theService.getSelector = () => {
    return selector;
  };

  theService.isTimeSufficientlyLongAgo = (time, targetTimeInMillis) => {
    if (time === undefined) return false;

    let exchange = _getExchange();
    let rtn = false;

    // TODO: phase out in favor of calling exchange.getDirection()
    if (exchange.historyScan === 'backward') rtn = time < targetTimeInMillis;
    else rtn = time > targetTimeInMillis;

    return rtn;
  };

  return theService;
};
