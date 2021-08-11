// mqtt.js - Message service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const mqtt = require('mqtt');

// Local data

var master;
var config;

var nodes;
var client;

// Local functions

// Init service
function init(service, section) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Keep master
    master = service;
    config = section;

    debug('++ messages service');
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
    // Construct server uri
    const prot = (config.protocol || 'ws') + '://';
    const host = config.host;
    const port = (config.port === undefined)?'':(':' + config.port);

    const uri = prot + host + port;

    debug('<> messages on ' + uri);

    // Connect client
    client = mqtt.connect(uri)
    // Connection established
    .on('connect', () => {
      debug('<> messages connect ' + client.options.clientId);
    })
    // Topic changed
    .on('message', (topic, message, packet) => {
      // Node id is topic
      const id = packet.topic;

      // Ignore internal publish
//      if (packet.internal) {
//        debug('<< messages pub ' + id);
//        return;
//      }

      // Removing topic?
      if (packet.payload.length === 0) {
        debug('>> messages remove ' + id);
        nodes.setNode(id);
        return;
      }

      // Client publish
      debug('>> messages pub ' + id);

      // Failed to parse?
      const node = parse(packet.payload);
      if (node === null) return;

      // Add node
      nodes.setNode(id, node);
    })
    // Failure
    .on('error', (e) => {
      error('client error: ' + e.message);
    });

    // Subscribe
    subscribe('#');
    resolve();
  });
}

// Term service
function term() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Catch app close
    client.on('end', () => {
      debug('>< messages closed');
      resolve();
    });

    // Close client
    client.end();
  });
}

// Exit service
function exit() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Destroy objects
    nodes = undefined;
    client = undefined;

    debug('-- messages service');
    resolve();
  });
}

// Subscribe to node
function subscribe(topic) {
  debug('<< messages sub ' + topic);

  client.subscribe(topic, {
    qos: 0,
    rap: true
  }, (e) => {
    if (e) error('subscribe error: ' + e.message);
  });
}

// Publish node
function publish(topic, node) {
  debug('<< messages pub ' + topic);

  const message = stringify(node);
  if (message === null) return;

  client.publish(topic, message, {
    retain: true
  }, (e) => {
    if (e) error('publish error: ' + e.message);
  });
}

// Parse json packet
function parse(packet) {
  try {
    return JSON.parse(packet);
  } catch (e) {
    error('parse error: ' + e.message);
  }
  return null;
}

// Stringify json packet
function stringify(packet, format) {
  try {
    return JSON.stringify(packet);
  } catch (e) {
    error('stringify error: ' + e.message);
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
