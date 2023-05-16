import normalizeSelector from './normalize-selector';

export default selector => {
  let rtn;

  if (typeof selector == 'string') {
    var s = normalizeSelector(selector);

    let e_id = s.split('.')[0];
    let p_id = s.split('.')[1];
    let asset = p_id.split('-')[0];
    let currency = p_id.split('-')[1];

    rtn = { exchange_id: e_id, product_id: p_id, asset: asset, currency: currency, normalized: s };
  } else if (typeof selector == 'object') {
    rtn = selector;
  }

  return rtn;
};
