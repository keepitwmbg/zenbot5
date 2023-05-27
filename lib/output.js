import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

export default conf => {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  let initializeOutput = async tradeObject => {
    for (var output in conf.output) {
      if (conf.output[output].on) {
        if (conf.debug) {
          console.log(`initializing output ${output}`);
        }
        let result = await import(path.resolve(__dirname, `../extensions/output/${output}.js`));
        result.default(conf).run(conf.output[output], tradeObject);
      }
    }
  };

  return {
    initializeOutput: initializeOutput,
  };
};
