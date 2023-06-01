import EventEmitter from 'events';
import fs from 'fs';
import _ from 'lodash';
import minimist from 'minimist';
import mongodb from 'mongodb';
import path from 'path';

export default async () => {
  let { version } = JSON.parse(fs.readFileSync('./package.json'));
  let zenbot = {};
  zenbot.version = version;
  let args = minimist(process.argv.slice(3));
  let conf = {};
  let config = {};
  let overrides = {};

  zenbot.debug = args.debug;

  // 1. load conf overrides file if present
  if (!_.isUndefined(args.conf)) {
    try {
      overrides = await import(path.resolve(process.cwd(), args.conf));
    } catch (err) {
      console.error(err + ', failed to load conf overrides file!');
    }
  }

  // 2. load conf.js if present
  try {
    conf = await import('./conf.js');
  } catch (err) {
    console.error(err + ', falling back to conf-sample');
  }

  // 3. Load conf-sample.js and merge
  // overrides > conf > defaults
  let defaults = await import('./conf-sample.js');
  _.defaultsDeep(config, overrides.c, conf.c, defaults.c);
  zenbot.conf = config;

  // add EventEmitter to conf
  let eventBus = new EventEmitter();
  zenbot.conf.eventBus = eventBus;

  let authStr = '',
    authMechanism,
    connectionString;

  if (zenbot.conf.mongo.username) {
    authStr = encodeURIComponent(zenbot.conf.mongo.username);

    if (zenbot.conf.mongo.password) authStr += ':' + encodeURIComponent(zenbot.conf.mongo.password);

    authStr += '@';

    // authMechanism could be a conf.js parameter to support more mongodb authentication methods
    authMechanism = zenbot.conf.mongo.authMechanism || 'DEFAULT';
  }

  if (zenbot.conf.mongo.connectionString) {
    connectionString = zenbot.conf.mongo.connectionString;
  } else {
    connectionString =
      'mongodb://' +
      authStr +
      zenbot.conf.mongo.host +
      ':' +
      zenbot.conf.mongo.port +
      '/' +
      zenbot.conf.mongo.db +
      '?' +
      (zenbot.conf.mongo.replicaSet ? '&replicaSet=' + zenbot.conf.mongo.replicaSet : '') +
      (authMechanism ? '&authMechanism=' + authMechanism : '');
  }

  // connect db
  try {
    let client = await mongodb.MongoClient.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    let db = client.db(zenbot.conf.mongo.db);
    _.set(zenbot, 'conf.db.mongo', db);
    return zenbot;
  } catch (err) {
    if (err) {
      console.error('WARNING: MongoDB Connection Error: ', err);
      console.error('WARNING: without MongoDB some features (such as backfilling/simulation) may be disabled.');
      console.error('Attempted authentication string: ' + connectionString);
      return zenbot;
    }
  }
};
