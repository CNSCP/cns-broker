// service.js - Service manager
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const path = require('path');
const colours = require('colors');

const pack = require('../package.json');

// Local data

var terminating = false;

var config = {};
var handlers = {};

var sections = {};
var services = {};

// Local functions

// Start sdk
function start(options, events) {
	// Keep config
	if (options !== undefined) Object.assign(config, options);
	if (events !== undefined) Object.assign(handlers, events);

	// Process command line
	commands(process.argv.slice(2));

	// Output welcome
	print(config.environment + ': ' + version());

	system();
	memory();

	print('startup...');

	// Load each service
	config.services.forEach((name) => {
		try {
			// Require service
			const section = config[name] || {};
			const module = section.module || name;

			services[name] = require('./' + module + '.js');
			sections[name] = section;
		}
		// Failure
		catch(e) {
			debug(e.stack);
			error('service ' + name + ' error: ' + e.message);
			process.exit(1);
		}
	});

	// Init services
	return signal('init')
	// Success
	.then((result) => {
		// Start services
		return signal('start');
	})
	// Success
	.then((result) => {
		// Run services
		return signal('run');
	})
	// Success
	.then((result) => {
		print('running...');
		return null;
	})
	// Failure
	.catch((e) => {
		error('startup error: ' + e.message);
		process.exit(1);
	});
}

// Stop agent
function stop() {
	print('shutdown...');
	terminating = true;

	// Terminate services
	return signal('term')
	// Success
	.then((result) => {
		// Stop services
		return signal('stop');
	})
	// Success
	.then((result) => {
		// Exit services
		return signal('exit');
	})
	// Success
	.then((result) => {
		print('terminated...');
		memory();
		return null;
	})
	// Failure
	.catch((e) => {
		error('shutdown error: ' + e.message);
		process.exit(1);
	});
}

// Signal services
function signal(event) {
	// Signal each service
	debug('** ' + event);
	var promises = [];

	for (var name in services) {
		// Get event handler
		const fn = services[name][event];

		if (typeof fn === 'function') {
			const section = sections[name];
			promises.push(fn(exports, section));
		}
	}
	return Promise.all(promises);
}

// Process command line
function commands(args) {
	// Get run mode
	const envs = config.environments || [];
	var mode = envs[0];

	envs.forEach((env) => {
		const n = args.indexOf('--' + env);

		if (n !== -1) {
			mode = env;
			args.splice(n, 1);
		}
	});

	if (mode !== undefined)
		merge(config, require('../environments/' + mode + '/config.json'));

	// Get handlers
	const flags = handlers.flags || [];
	const flag = handlers.flag;

	// More args?
	while(args.length > 0) {
		// Get next arg
	  const arg = args.shift();
		var value;

	  switch(arg) {
	    case '--help':
	    case '-h':
	    case '-?':
	      // Output usage
				usage(flags, envs);
	      process.exit(0);
	      break;
	    case '--version':
	    case '-v':
	      // Output version
	      console.log('v' + version());
	      process.exit(0);
	      break;
			case '--silent':
				// Set silent output
				config.output = 'silent';
				break;
			case '--verbose':
				// Set verbose output
	      config.output = 'verbose';
	      break;
	    default:
	      // Find flag
				const found = locate(flags, arg);

				if (found[1] !== null) {
					// Get value?
					value = args.shift();

					if (value === undefined || value.startsWith('-')) {
			      console.log('Expected ' + found[1] + ' after ' + arg);
			      process.exit(1);
					}

					// Set to undefined?
					if (value === 'none')
						value = undefined;
				}
	      break;
	  }

		// Call handler
		if (flag !== undefined)
			flag(arg, value);
	}
}

// Output usage info
function usage(flags, envs) {
	// Output usage
	const base = path.basename(process.argv[1], '.js');
	console.log('\n  Usage: ' + base + ' [flags...]\n');

	detail(['--help', null, 'Output usage information']);
  detail(['--version', null, 'Output version information']);

	// Output envs and flags
	envs.forEach((env) => detail(['--' + env, null, 'Run in ' + env + ' mode']));
	flags.forEach((flag) => detail(flag));

	// Output the rest
	detail(['--silent', null, 'Set silent output']);
	detail(['--verbose', null, 'Set verbose output']);

	console.log('');
}

// Output flag details
function detail(flag) {
	const arg = flag[0] + ' ' + (flag[1] || '');
	console.log('  ' + arg.padEnd(14, ' ') + ' ' + flag[2]);
}

// Locate named flag
function locate(flags, arg) {
	// Locate flag
	for(var len = flags.length, n = 0; n < len; n++)
		if (arg === flags[n][0]) return flags[n];

	// Flag not found
  console.log('Unknown flag: ' + arg);
  process.exit(1);
}

// Return runtime version
function version() {
	return pack.version;
}

// Return runtime environment
function environment() {
	return config.environment;
}

// System stats
function system() {
	// Ignore it?
	if (config.output !== 'verbose') return;

	const os = require('os');

	debug(os.platform() + ': ' + os.release());
	debug('node: ' + process.versions.node);
	debug('total: ' + format(os.totalmem()));
	debug('free: ' + format(os.freemem()));
}

// Memory stats
function memory() {
	// Ignore it?
	if (config.output !== 'verbose') return;

	// --expose-gc for garbage collection
	if (global.gc !== undefined) global.gc();
	const usage = process.memoryUsage();

	debug('rss: ' + format(usage.rss));
	debug('heap: ' + format(usage.heapTotal));
	debug('used: ' + format(usage.heapUsed));
	debug('extern: ' + format(usage.external));
}

// Format bytes
function format(bytes) {
	const range = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const k = 1024;
	const p = (bytes === 0)?0:(Math.floor(Math.log(bytes) / Math.log(k)));

	return parseFloat((bytes / Math.pow(k, p)).toFixed(2)) + ' ' + range[p];
}

// Check if object
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

// Deep merge
function merge(target, ...sources) {
	// Get next source
  if (!sources.length) return target;
  const source = sources.shift();

	// Must be objects
  if (isObject(target) && isObject(source)) {
		// Merge each child
    for (const key in source) {
			// Already exists?
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, {[key]: {}});
        merge(target[key], source[key]);
      } else Object.assign(target, {[key]: source[key]});
    }
  }
  return merge(target, ...sources);
}

// Set service config override
function set(service, property, value) {
  // Create if missing
  var section = config[service];

  if (section === undefined) {
    section = {};
    config[service] = section;
  }

  // Set config value
  section[property] = value;
}

// Check if service exists
function exists(name) {
	return (services[name] !== undefined);
}

// Get service
function find(name) {
	if (!exists(name))
		throw new Error('no ' + name + ' service');

	return services[name];
}

// Output a message
function print(text) {
	// Only if not silent
	if (config.output !== 'silent')
		console.log(pack.name + ': ' + text);
}

// Output a debug
function debug(text) {
	// Only if verbose
	if (config.output === 'verbose')
		print(text.green);
}

// Output an error
function error(text) {
	print(text.red);
}

// Catch ctrl+c
process.on('SIGINT', () => {
	console.log('\r');

	if (terminating)
		process.exit(1);

	stop();
});

// Exports

exports.start = start;
exports.stop = stop;

exports.version = version;
exports.environment = environment;

exports.set = set;
exports.exists = exists;
exports.find = find;

exports.print = print;
exports.debug = debug;
exports.error = error;

exports.config = config;
exports.handlers = handlers;
