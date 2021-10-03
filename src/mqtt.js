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

var terminating;

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
    const prot = config.protocol || 'mqtt';
    const host = config.host;
    const port = (config.port === undefined)?'':(':' + config.port);

    const uri = prot + '://' + getAuth() + host + port;

    debug('<> messages on ' + host + port);
    debug('<> messages root ' + getTopic());

    var attempts = 0;

    terminating = false;

    // Connect client
    client = mqtt.connect(uri)
    // Connection established
    .on('connect', () => {
      debug('<> messages connect ' + client.options.clientId);

      // Set subscription topic from config, otherwise default to '#'
      var subscription_topic = config.subscribe.topic || "#"
      if (process.env.MQTT_SUBSCRIBE_TOPIC) {
        subscription_topic = process.env.MQTT_SUBSCRIBE_TOPIC
        debug('<> Loading MQTT subscribe topic from ENV Var: "' + subscription_topic + '"')
      }

      // First attempt?
      if (attempts++ === 0)
        subscribe(subscription_topic);
    })
    // Topic changed
    .on('message', (topic, message, packet) => {
      // Ignore if term
      if (terminating) return;

      // Get id from topic
      const id = getId(topic);

      // Removing topic?
      if (packet.payload.length === 0) {
        debug('>> messages remove ' + id.name);
        nodes.setNode(id);
        return;
      }

      debug('>> messages pub ' + id.name);

      // Set node
      const node = parse(packet.payload);
      if (node === null) return;

      nodes.setNode(id, node);
    })
    // Failure
    .on('error', (e) => {
      error('client error: ' + e.message);
    });

    resolve();
  });
}

// Term service
function term() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Stop subscribing
    unsubscribe('#');

    // Now terminating
    terminating = true;

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

// Get server auth
function getAuth() {
  const user = config.user;
  const pass = config.pass;

  if (user === undefined) return '';
  if (pass === undefined) return user + '@';

  return user + ':' + pass + '@';
}

// Subscribe to node
function subscribe(id) {
  if (typeof id === 'string') id = {name: id};

  const topic = getTopic(id);
  debug('<< messages sub ' + id.name);

  client.subscribe(topic, config.subscribe, (e) => {
    if (e) error('subscribe error: ' + e.message);
  });
}

// Unsubscribe to node
function unsubscribe(id) {
  if (typeof id === 'string') id = {name: id};

  const topic = getTopic(id);
  debug('<< messages unsub ' + id.name);

  client.unsubscribe(topic, config.unsubscribe, (e) => {
    if (e) error('unsubscribe error: ' + e.message);
  });
}

// Publish node
function publish(id, node) {
  const topic = getTopic(id);
  debug('<< messages pub ' + id.name);

  const message = stringify(node);
  if (message === null) return;

  client.publish(topic, message, config.publish, (e) => {
    if (e) error('publish error: ' + e.message);
  });
}

// Get topic from id
function getTopic(id) {
  // Load root topic from ENV if present.
  if (process.env.MQTT_ROOT_TOPIC) {
    debug('<> Loading root MQTT topic from ENV Var')
    return process.env.MQTT_ROOT_TOPIC
  }

  const path = [];

  const root = config.root || '';
  const ident = (id === undefined)?'':(id.ident || '');
  const name = (id === undefined)?'':(id.name || '');

  if (root !== '') path.push(root);
  if (ident !== '') path.push(ident);
  if (name !== '') path.push(name);

  return path.join('/');
}

// Get id from topic
function getId(topic) {
  const path = topic.split('/');

  const root = config.root || '';
  if (root !== '') path.shift();

  const ident = path.shift();
  const name = path.join('/');

  return {
    ident: ident,
    name: name
  };
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
