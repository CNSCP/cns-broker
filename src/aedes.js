// aedes.js - Message service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const aedes = require('aedes');
const factory = require('aedes-server-factory');

// Local data

var master;
var config;

var nodes;

var app;
var server;

// Local functions

// Init service
function init(service, section) {
	// I promise to
  return new Promise((resolve, reject) => {
		// Keep master
		master = service;
		config = section;

    // Initialize aedes
    app = aedes(config)
    // Client connect
    .on('clientReady', (client) => {
      debug('>> message connect ' + client.id);
    })
    // Client publish
    .on('publish', (packet, client) => {
      // Ignore server publish
      if (client === null) return;

      //
      const id = packet.topic;

      // Ignore internal publish
      if (packet.internal) {
        debug('<< message pub ' + id);
        return;
      }

      // Removing topic?
      if (packet.payload.length === 0) {
        debug('>> message remove ' + id);
        nodes.removeNode(id);
        return;
      }

      // Client publish
      debug('>> message pub ' + id);

      // Failed to parse?
      const node = parse(packet.payload);
      if (node === null) return;

      // Add node
      nodes.addNode(id, node);
    })
    // Client subscribe
    .on('subscribe', (subs, client) => {
      for (const packet of subs)
        debug('>> message sub ' + packet.topic);
    })
    // Client unsibscribe
    .on('unsubscribe', (unsubs, client) => {
      for (const topic of unsubs)
        debug('>> message unsub ' + topic);
    })
    // Client disconnect
    .on('clientDisconnect', (client) => {
      debug('>> message disconnect ' + client.id);
    })
    // Client error
    .on('clientError', (client, e) => {
      error('Client error: ' + client.id + ' ' + e.message);
    })
    // Connection error
    .on('connectionError', (client, e) => {
      error('Connection error: ' + client.id + ' ' + e.message);
    });

		debug('++ message service aedes');
		resolve();
	});
}

// Start service
function start() {
	// I promise to
  return new Promise((resolve, reject) => {
		// Get services
		nodes = master.find('nodes');
		resolve();
	});
}

// Run service
function run() {
	// I promise to
  return new Promise((resolve, reject) => {
		// Get config
		const host = config.host;
		const port = config.port;

		// Start server
    server = factory.createServer(app, {
      ws: true
    })
		// Listen on port
    .listen(port, host, () => {
			debug('<> message on ' + host + ':' + port);
			resolve();
    })
		// Failure
		.on('error', (e) => {
			reject(e);
		});
	});
}

// Term service
function term() {
	// I promise to
  return new Promise((resolve, reject) => {
    // Catch app close
    app.on('closed', () => {
      debug('>< message closed');

      // Close server
  		if (server !== undefined)
        server.close();

      resolve();
    });

    // Close app
		app.close();
	});
}

// Exit service
function exit() {
	// I promise to
  return new Promise((resolve, reject) => {
		// Destroy objects
    nodes = undefined;

		app = undefined;
		server = undefined;

		debug('-- message service');
		resolve();
	});
}

// Publish node
function publish(id, node) {
  // Get payload
  const packet = stringify(node);
  if (packet === null) return;

  const payload = Buffer.from(packet);

  // Publish to subscribers
  app.publish({
    cmd: 'publish',
    internal: true,
    retain: true,
    topic: id,
    qos: 0,
    payload: payload
  }, (e) => {
    // Failure
    if (e !== null)
      error(e.message);
  });
}

// Parse json packet
function parse(packet) {
	try {
		return JSON.parse(packet);
	} catch (e) {
		error('Parse error: ' + e.message);
	}
	return null;
}

// Stringify json packet
function stringify(packet) {
	try {
		return JSON.stringify(packet);
	} catch (e) {
		error('Stringify error: ' + e.message);
	}
	return null;
}

// Output a message
function print(text) {
	master.print(text);
}

// Output a debug
function debug(text) {
	master.debug(text);
}

// Output an error
function error(text) {
	master.error(text);
}

// Exports

exports.init = init;
exports.start = start;
exports.run = run;
exports.term = term;
exports.exit = exit;

exports.publish = publish;
