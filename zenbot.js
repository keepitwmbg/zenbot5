import { Command } from 'commander';
import fs from 'node:fs/promises';
import path, { dirname } from 'path';
import semver from 'semver';
import { fileURLToPath } from 'url';
import boot from './boot.js';

let versions = process.versions;

if (semver.gt('v18.16.0', versions.node)) {
  console.log('You are running a node.js version older than 18.16.0, please upgrade via https://nodejs.org/en/');
  process.exit(1);
}

// conf setting and db connection
let zenbot = await boot();

const program = new Command();
program._name = 'zenbot';
program.version(zenbot.version);

// search command file
let command_directory = './commands';
let files;

files = await fs.readdir(command_directory);

// check command files
let commands = files
  .map(file => {
    return path.join(command_directory, file);
  })
  .filter(async file => {
    return (await fs.lstat(file)).isFile();
  });

// import all command files
const __dirname = dirname(fileURLToPath(import.meta.url));
for (let file of commands) {
  let command = await import(path.resolve(__dirname, file));
  command.default(program, zenbot.conf);
}

program.command('*', 'Display help', { noHelp: true }).action(cmd => {
  console.log('Invalid command: ' + cmd);
  program.help();
});

// parse process.argv
program.parse(process.argv);
