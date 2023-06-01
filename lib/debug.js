import minimist from 'minimist';
import moment from 'moment';

let args = minimist(process.argv.slice(3));
let debug = args.debug;
export default {
  flip: () => {
    on = debug = !debug; // ?
  },
  msg: str => {
    if (debug) {
      console.error('\n' + moment().format('YYYY-MM-DD HH:mm:ss') + ' - ' + str);
    }
  },
  on: debug,
};
