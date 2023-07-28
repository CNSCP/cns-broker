// proxy.js - Proxy service
// Copyright 2023 Padi, Inc. All Rights Reserved.

// wss://eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJwYWRpLWFwcCIsImlzcyI6ImVRRXVUZWwxeXBkSTkwSkhZUHJmIiwic3ViIjoiSXJYbnBGU1B3ZGVvMHJBOUhqS3AiLCJpYXQiOjE2OTA0NjUzNTh9.uZFjeP7qBSRaKGw79hX9_NDWekmnE14UHKFnhXmEYEQ@cns.padi.io:1881#thing/IrXnpFSPwdeo0rA9HjKp

'use strict';

// Imports

const mqtt = require("mqtt");

// Constants

const PADI_PAYLOAD = 'padi';
const CNS_PAYLOAD = 'cns';

// Local data

var master;
var config;

var messages;
var nodes;
var profiles;

var clients;

// Local functions

// Init service
function init(service, section) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Keep master
    master = service;
    config = section;

    debug('++ proxy service mqtt');
    resolve();
  });
}

// Start service
function start() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Get services
    messages = master.find('messages');
    nodes = master.find('nodes');
    profiles = master.find('profiles');

    resolve();
  });
}

// Run service
function run() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Reset clients
    clients = {};
    resolve();
  });
}

// Term service
function term() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Close open clients
    for (const id in clients)
      close(id);

    resolve();
  });
}

// Exit service
function exit() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Destroy objects
    messages = undefined;
    nodes = undefined;
    profiles = undefined;

    clients = undefined;

    debug('-- proxy service');
    resolve();
  });
}

// Connect node to proxy
function connect(id, node) {
  // Scan nodes
  const scan = nodes.getNodes();

  const valid = [];
  const invalid = [];

  for (const id in scan) {
    // Scan node properties
    const node = scan[id];
    const proxy = node.proxy;

    if (proxy !== undefined && proxy !== '') {
      try {
        // Open proxy connection
        const url = new URL(proxy);

        const subscribe = url.hash.substr(1);
        const payload = url.hostname.endsWith('.padi.io')?PADI_PAYLOAD:CNS_PAYLOAD;

        if (subscribe.includes('#') || subscribe.includes('+') ||
          (payload === PADI_PAYLOAD && !subscribe.startsWith('thing/')))
          throw new Error('illegal ' + payload + ' topic ' + subscribe);

        open(id, url.origin, url.username, url.password, subscribe, payload);
        valid.push(id);
      } catch(e) {
        error('proxy error: ' + e.message);
      }
    }
  }

  // Check existing are valid
  for (const id in clients)
    if (!valid.includes(id)) invalid.push(id);

  // Close invalid
  for (const id of invalid)
    close(id);
}

// Update node for proxy
function update(id, node) {
  // Proxy changed?
  const prev = nodes.getNode(id);

  if (prev === null || node === undefined ||
    prev.proxy === node.proxy) return;

  var changed = false;

  // Remove proxied profiles
  const profiles = node.profiles;

  if (Array.isArray(profiles)) {
    const keep = [];

    for (const profile of profiles) {
      if (profile.proxy === undefined)
        keep.push(profile);
      else changed |= true;
    }

    if (changed) {
      if (keep.length > 0)
        node.profiles = keep;
      else delete node.profiles;
    }
  }

  if (!changed) return;

  messages.publish(id, node);
}

// Open connection
function open(id, uri, username, password, subscribe, payload) {
  // Client already exists?
  var client = clients[id];

  if (client === undefined) {
    try {
      var first = true;

      // Connect client
      debug('<< proxy connecting ' + uri);

      client = mqtt.connect(uri, {
        username: username,
        password: password
      })
      // Connected
      .on('connect', () => {
        debug('<> proxy connected ' + uri);

        if (first) {
          // Subscribe to topic
          debug('<< proxy subscribing ' + subscribe);
          client.subscribe(subscribe);

          first = false;
        }
      })
      // Message received
      .on('message', (topic, message) => {
        debug('>> proxy message ' + uri);

        try {
          // What type?
          switch (payload) {
            case PADI_PAYLOAD:
              padiPayload(id, subscribe, topic, message);
              break;
            case CNS_PAYLOAD:
              cnsPayload(id, subscribe, topic, message);
              break;
          }
        } catch(e) {
          abort(id, client, e);
        }
      })
      // Client error
      .on('error', (e) => {
        abort(id, client, e);
      });

      // Keep client
      clients[id] = client;
    } catch(e) {
      abort(id, client, e);
    }
  }
  return client;
}

// Abort connection
function abort(id, client, e) {
  error('proxy abort: ' + e.message);

  if (client !== undefined) {
    debug('>< proxy disconnecting ' + id);
    client.end();
  }
  clients[id] = null;
}

// Close connection
function close(id) {
  const client = clients[id];

  if (client !== undefined && client !== null) {
    debug('>< proxy disconnecting ' + id);
    client.end();
  }
  delete clients[id];
}

// Handle padi payload
function padiPayload(id, subscribe, topic, message) {
  // Check topic as requested?
  if (topic !== subscribe)
    throw new Error('received wrong topic ' + topic);

  // Decode payload
  const payload = JSON.parse(message);

  // Has things in payload?
  const things = payload.padiThings;

  if (things === undefined || typeof things !== 'object')
    throw new Error('malformed payload ' + topic);

  // Get thing id from topic
  const parts = topic.split('/');
  const thingId = parts[1];

  // Has thing in payload?
  const thing = payload.padiThings[thingId];

  if (thing === undefined || typeof thing !== 'object')
    throw new Error('malformed payload data ' + thingId);

  // Has connections?
  const conns = payload.padiConnections;

  if (conns !== undefined && typeof conns !== 'object')
    throw new Error('malformed payload connections ' + thingId);

  // Get node?
  const node = nodes.getNode(id);

  if (node === null)
    throw new Error('node has gone ' + id);

  // Update changes
  var changed = false;

  // Generate profiles
  const promises = [];
  const profiles = [];

  // Keep non-proxied profiles
  if (Array.isArray(node.profiles)) {
    for (const profile of node.profiles) {
      if (profile.proxy === undefined) profiles.push(profile);
      else changed = true;
    }
  }

  // Has connections?
  if (conns !== undefined) {
    // Copy connection profiles
    for (const connId in conns) {
      promises.push(padiConnection(id, thingId, connId, conns[connId], profiles));
      changed = true;
    }
  }

  // Node changed?
  if (!changed) return;

  //
  Promise.all(promises)
  // Success
  .then((result) => {
    // Set new profiles
    if (profiles.length > 0)
      node.profiles = profiles;
    else delete node.profiles;

    // Connect them all
    return nodes.connect();
  })
  // Success
  .then((result) => {
    // Publish node
    messages.publish(id, node);
  })
  // Failure
  .catch((e) => {
    error('node error: ' + e.message);
  });
}

// Handle padi connection
function padiConnection(id, thingId, connId, conn, results) {
  // Get details
  var role;

  if (conn.padiServer === thingId) role = 'server';
  else if (conn.padiClient === thingId) role = 'client';
  else return null;

  const name = conn.padiProfile;
  const version = conn.padiVersion;
  const properties = conn.padiProperties;

  // Fetch profile
  return Promise.resolve(profiles.cacheProfile(name))
  // Success
  .then((result) => {
    // Get definition?
    const definition = profiles.getProfile(name);
    if (definition === null) return null;

    // Get version?
    const versions = definition.versions;
    const index = version || versions.length;

    const v = versions[index - 1];
    if (v === undefined) return null;

    // Sort properties
    const properties1 = {};
    const properties2 = {};

    for (const property of v.properties) {
      const name = property.name;
      const value = properties[name];

      if ((role === 'server' && property.server !== undefined) ||
        (role === 'client' && property.server === undefined))
        properties1[name] = value;
      else properties2[name] = value;
    }

    // Create this side
    const profile1 = {
      proxy: connId,
      name: name
    };

    if (version !== undefined && version !== '')
      profile1.version = version;

    profile1[role] = id;

    if (Object.keys(properties1).length > 0)
      profile1.properties = properties1;

    results.push(profile1);

    // Reverse role
    role = (role === 'server')?'client':'server';

    // Create that side
    const profile2 = {
      proxy: connId,
      ignore: true,
      name: name
    };

    if (version !== undefined && version !== '')
      profile2.version = version;

    profile2[role] = connId;

    if (Object.keys(properties2).length > 0)
      profile2.properties = properties2;

    results.push(profile2);

    return connId;
  });
}

// Handle cns payload
function cnsPayload(id, subscribe, topic, message) {
  // Check topic as requested?
  if (topic !== subscribe)
    throw new Error('received wrong topic ' + topic);

  // Decode payload
  const payload = JSON.parse(message);




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

exports.connect = connect;
exports.update = update;
