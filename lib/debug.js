import moment from 'moment';
import boot from '../boot.js';

let debug = boot.debug;
export default {
  flip: function () {
    module.exports.on = debug = !debug;
  },
  msg: function (str) {
    if (debug) {
      console.error('\n' + moment().format('YYYY-MM-DD HH:mm:ss') + ' - ' + str);
    }
  },
  on: debug,
};