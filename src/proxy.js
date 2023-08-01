// proxy.js - Proxy service
// Copyright 2023 Padi, Inc. All Rights Reserved.

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

// Manage node proxy
function manage(id, node) {
  // Get node details
  const prev = nodes.getNode(id);

  // Disconnect?
  if (node === undefined ||
    (prev !== null && node.proxy !== prev.proxy))
    disconnect(id, node);

  // Connect?
  if (node !== undefined &&
    node.proxy !== undefined && node.proxy !== '')
    connect(id, node);

  // Update profile changes
  if (node !== undefined && prev !== null)
    update(id, node, prev);
}

// Connect proxy node
function connect(id, node) {
  const proxy = node.proxy;

  try {
    // Open proxy connection
    const url = new URL(proxy);

    const payload = url.hostname.endsWith('.padi.io')?PADI_PAYLOAD:CNS_PAYLOAD;
    var topic = url.hash.substr(1);

    // Valid topic?
    if (topic.includes('#') || topic.includes('+') ||
      (payload === PADI_PAYLOAD && !topic.startsWith('thing/')))
      throw new Error('illegal ' + payload + ' topic ' + topic);

    open(id,
      url.origin,
      url.username,
      url.password,
      topic,
      payload);
  } catch (e) {
    error('proxy error: ' + e.message);
  }
}

// Disconnect proxy node
function disconnect(id, node) {
  // Close proxy connection
  close(id);

  // Node deleted?
  if (node === undefined) return;

  var changed = false;

  // Remove proxied profiles
  const profiles = node.profiles;

  if (Array.isArray(profiles)) {
    const keep = [];

    for (const profile of profiles) {
      if (profile.proxy === undefined)
        keep.push(profile);
      else changed = true;
    }

    if (changed) {
      if (keep.length > 0)
        node.profiles = keep;
      else delete node.profiles;
    }
  }

  // Publish changes
  if (changed) messages.publish(id, node);
}

// Update proxy node
function update(id, node, prev) {
  // Client is connected?
  const client = clients[id];

  if (client !== undefined && client !== null) {
    // Look for differences
    const profiles1 = node.profiles;
    const profiles2 = prev.profiles;

    // No profiles?
    if (!Array.isArray(profiles1) ||
      !Array.isArray(profiles2))
      return false;

    // Scan profiles
    for (const profile1 of profiles1) {
      // Not proxy profile?
      if (typeof profile1.proxy !== 'object') continue;

      // Has profile properties?
      const properties1 = profile1.properties;
      if (properties1 === undefined) continue;

      // Look for previous
      var properties2;

      for (const profile2 of profiles2) {
        // Profiles match?
        if (typeof profile2.proxy === 'object' &&
          profile2.name === profile1.name && profile2.version === profile1.version &&
          profile2.client === profile1.client && profile2.server === profile2.server) {
          // Found it
          properties2 = profile2.properties;
          break;
        }
      }

      // Found previous?
      if (properties2 === undefined) continue;

      // Properties changed?
      var changed = false;

      if (Object.keys(properties1).length === Object.keys(properties2).length) {
        // Values changed?
        for (const property in properties1) {
          if (properties1[property] !== properties2[property]) {
            changed = true;
            break;
          }
        }
      } else changed = true;

      if (changed) {
        // What type?
        switch (client.cnsPayload) {
          case PADI_PAYLOAD:
            padiPublish(id, client, profile1);
            break;
          case CNS_PAYLOAD:
            cnsPublish(id, client, profile1);
            break;
        }
      }
    }
  }
  return false;
}

// Open connection
function open(id, uri, username, password, topic, payload) {
  // Client already exists?
  var client = clients[id];

  if (client === undefined) {
    try {
      var first = true;

      // Connect client
      debug('<< proxy connecting ' + id);

      client = mqtt.connect(uri, {
        username: username,
        password: password
      })
      // Connected
      .on('connect', () => {
        debug('<> proxy connected ' + id);

        if (first) {
          // Subscribe to topic
          debug('<< proxy sub ' + topic);

          client.subscribe(topic);
          first = false;
        }
      })
      // Message received
      .on('message', (topic, message) => {
        debug('>> proxy message ' + topic);

        try {
          // Check topic as requested?
          if (topic !== client.cnsTopic)
            throw new Error('received wrong topic ' + topic);

          // What type?
          switch (client.cnsPayload) {
            case PADI_PAYLOAD:
              padiMessage(id, topic, message);
              break;
            case CNS_PAYLOAD:
              cnsMessage(id, topic, message);
              break;
          }
        } catch (e) {
          abort(id, client, e);
        }
      })
      // Client error
      .on('error', (e) => {
        abort(id, client, e);
      });

      // Keep client
      client.cnsTopic = topic;
      client.cnsPayload = payload;

      clients[id] = client;
    } catch (e) {
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

  if (client !== undefined) {
    debug('>< proxy disconnecting ' + id);

    if (client !== null) client.end();
    delete clients[id];
  }
}

// Handle padi message
function padiMessage(id, topic, message) {
  // Get thing id from topic
  const parts = topic.split('/');
  const thingId = parts[1];

  // Decode payload
  const payload = JSON.parse(message);

  // Get connections?
  const conns = (parts[2] === 'connections')?
    payload:payload.padiConnections;

  if (typeof conns !== 'object')
    throw new Error('malformed payload ' + topic);

  // Get node?
  const node = nodes.getNode(id);

  if (node === null)
    throw new Error('proxy node not found ' + id);

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

  // Process connections
  for (const connId in conns) {
    // Add connection to profiles
    promises.push(padiConnection(
      id,
      thingId,
      connId,
      conns[connId],
      profiles));

    changed = true;
  }

  // Node changed?
  if (!changed) return;

  // Promise connections
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

    // Find existing profile?
    var profile;

    for (const scan of results) {
      if (scan.name === name && (!version || scan.version === version) &&
        scan[role] !== undefined) {
        // Found match
        profile = scan;
        break;
      }
    }

    // None found?
    if (profile === undefined) {
      // Create new proxy profile
      profile = {
        name: name
      };

      if (version !== undefined && version !== '')
        profile.version = version;

      profile[role] = id;

      if (Object.keys(properties1).length > 0)
        profile.properties = properties1;

      profile.proxy = {};

      results.push(profile);
    }

    // Create new proxy
    profile.proxy[connId] = properties2;

    return connId;
  });
}

// Handle padi publish
function padiPublish(id, client, profile) {
  // Publish to proxy
  const name = profile.name;
  const role = (profile.server !== undefined)?'server':'client';

  const parts = client.cnsTopic.split('/');
  const topic = 'thing/' + parts[1] + '/' + role + '/' + name;

  const payload = JSON.stringify(profile.properties);

  debug('proxy pub ' + topic);

  client.publish(topic, payload, {
    retain: true
  }, (e) => {
    if (e) error('proxy publish error: ' + e.message);
  });
}

// Handle cns message
function cnsMessage(id, topic, message) {
  // NYI
}

// Handle cns publish
function cnsPublish(id, client, profile) {
  // NYI
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

exports.manage = manage;
