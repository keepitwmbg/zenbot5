let precisionRound = function (number, precision) {
  let factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
};
export default function (s, key, length) {
  if (s.lookback.length >= length) {
    let avg_gain = s.lookback[0][key + '_avg_gain'];
    let avg_loss = s.lookback[0][key + '_avg_loss'];
    if (typeof avg_gain === 'undefined') {
      let gain_sum = 0;
      let loss_sum = 0;
      let last_close;
      s.lookback
        .slice(0, length)
        .reverse()
        .forEach(function (period) {
          if (last_close) {
            if (period.close > last_close) {
              gain_sum += period.close - last_close;
            } else {
              loss_sum += last_close - period.close;
            }
          }
          last_close = period.close;
        });
      s.period[key + '_avg_gain'] = gain_sum / length;
      s.period[key + '_avg_loss'] = loss_sum / length;
    } else {
      let current_gain = s.period.close - s.lookback[0].close;
      s.period[key + '_avg_gain'] = (avg_gain * (length - 1) + (current_gain > 0 ? current_gain : 0)) / length;
      let current_loss = s.lookback[0].close - s.period.close;
      s.period[key + '_avg_loss'] = (avg_loss * (length - 1) + (current_loss > 0 ? current_loss : 0)) / length;
    }

    if (s.period[key + '_avg_loss'] == 0) {
      s.period[key] = 100;
    } else {
      let rs = s.period[key + '_avg_gain'] / s.period[key + '_avg_loss'];
      s.period[key] = precisionRound(100 - 100 / (1 + rs), 2);
    }
  }
}
