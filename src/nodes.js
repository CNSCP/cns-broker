// nodes.js - Nodes service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Local data

var master;
var config;

var messages;
var profiles;

var idents;
var caching;

// Local functions

// Init service
function init(service, section) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Keep master
    master = service;
    config = section;

    idents = {};
    caching = 0;

    debug('++ nodes service');
    resolve();
  });
}

// Start service
function start() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Get services
    messages = master.find('messages');
    profiles = master.find('profiles');

    resolve();
  });
}

// Exit service
function exit() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Destroy objects
    messages = undefined;
    profiles = undefined;

    debug('-- nodes service');
    resolve();
  });
}

// Get node identities
function getIdents() {
  return idents;
}

// Get specific node
function getNode(id) {
  const ident = id.ident;
  const name = id.name;

  const nodes = idents[ident];

  if (nodes !== undefined)
    return nodes[name] || null;

  return null;
}

// Set node
function setNode(id, node) {
  const ident = id.ident;
  const name = id.name;

  var nodes = idents[ident];

  if (nodes === undefined) {
    nodes = {};
    idents[ident] = nodes;
  }

  // Removing node?
  if (node === undefined)
    delete nodes[name];
  else nodes[name] = node;

  // Connect them all
  connect(ident, nodes);
}

// Connect all nodes
function connect(ident, nodes) {
  // Reset cache if first
  if (caching++ === 0)
    profiles.cacheStart();

  // Resolve profiles
  cacheProfiles(nodes)
  // Failure
  .catch((e) => {
    error('caching error: ' + e.message);
  })
  // And finally
  .finally((result) => {
    // Connect nodes if last
    if (--caching === 0)
      connectProfiles(ident, nodes);

    return null;
  });
}

// Read profiles into cache
function cacheProfiles(nodes) {
  // Scan nodes
  const promises = [];

  for (const id in nodes) {
    // Scan node profiles
    const node = nodes[id];
    const scan = node.profiles || [];

    for (const profile of scan) {
      // Valid profile?
      if (profile.name !== undefined) {
        // Profile definition?
        if (profile.server === id || profile.client === id)
          promises.push(profiles.cacheProfile(profile.name));
      }
    }
  }
  return Promise.all(promises);
}

// Connect all profiles
function connectProfiles(ident, nodes) {
  // Keep changes
  const changes = [];

  // Connect and disconect nodes
  connectNodes(nodes, changes);
  disconnectNodes(nodes, changes);

  // Re-publish changes
  for (const name of changes) {
    // Publish each change
    messages.publish({
      ident: ident,
      name: name
    }, nodes[name]);
  }
}

// Connect all nodes
function connectNodes(nodes, changes) {
  // Scan nodes
  for (const id in nodes) {
    // Scan node profiles
    const node = nodes[id];
    const scan = node.profiles || [];

    for (const profile of scan) {
      // Valid profile?
      if (profile.name !== undefined) {
        // Profile definition?
        if (profile.server === id || profile.client === id)
          connectNode(nodes, id, node, profile, changes);
      }
    }
  }
}

// Disconnect relevant nodes
function disconnectNodes(nodes, changes) {
  // Scan nodes
  for (const id in nodes) {
    // Scan node profiles
    const node = nodes[id];
    const scan = node.profiles || [];

    const valid = [];
    const invalid = [];

    for (const profile of scan) {
      // Valid profile?
      const name = profile.name;
      const version = profile.version;

      if (name !== undefined) {
        // Profile definition?
        if (profile.server === id || profile.client === id) {
          // Mark as valid
          valid.push(profile);
          continue;
        }

        // Profile connection
        const role = (profile.server !== undefined)?'server':'client';
        const opposite = (role === 'server')?'client':'server';

        // Has definition?
        if (profileLocate(node, name, version, opposite, id)) {
          // Has opposite definition?
          const connId = profile[role];
          const conn = nodes[connId];

          if (conn !== undefined &&
            profileLocate(conn, name, version, role, connId)) {
            // Mark as valid
            valid.push(profile);
            continue;
          }
        }
      }

      // Mark as invalid
      debug('nodes disconnect ' + name + ' from ' + id);
      invalid.push(profile);
    }

    // Any invalid?
    if (invalid.length > 0) {
      // Only keep valid profiles
      node.profiles = valid;
      republish(id, changes);
    }
  }
}

// Connect node
function connectNode(nodes, id, node, profile, changes) {
  // Get profile properties
  const properties = propertiesGet(profile);
  if (properties === null) return;

  // Add profile properties
  var change = propertiesAdd(profile, properties);

  // Connect server to clients?
  if (profile.server === id &&
    connectClients(nodes, id, node, profile, properties, changes))
    change = true;

  // Publish node?
  if (change) republish(id, changes);
}

// Connect server to clients
function connectClients(nodes, serverId, server, profile, properties, changes) {
  // Scan nodes
  var change = false;

  for (const clientId in nodes) {
    // Client in same context?
    const client = nodes[clientId];

    if (clientId !== serverId &&
      client.context === server.context) {
      // Scan client profiles
      const scan = client.profiles || [];

      for (const match of scan) {
        // Connect client of same profile?
        if (match.client === clientId && profileMatch(profile, match) &&
          connectClient(serverId, server, profile, clientId, client, match, properties, changes))
          change = true;
      }
    }
  }
  return change;
}

// Connect server to client
function connectClient(serverId, server, profile, clientId, client, match, properties, changes) {
  // Add profiles
  const name = profile.name;
  const version = profile.version;

  const change = profileAdd(server, name, version, 'client', clientId, properties, match);
  const publish = profileAdd(client, name, version, 'server', serverId, properties, profile);

  // Re-publish client node?
  if (publish) republish(clientId, changes);

  return change;
}

// Add profile to node
function profileAdd(node, name, version, role, id, properties, copy) {
  // Profile exists?
  var change = false;
  var profile = profileLocate(node, name, version, role, id);

  if (profile === null) {
    // No, add new profile
    profile = {
      name: name
    };

    if (version !== undefined)
      profile.version = version | 0;

    profile[role] = id;

    node.profiles.push(profile);
    change = true;

    debug('nodes connect ' + name + ' to ' + id);
  }

  // Add properties to profile
  if (propertiesAdd(profile, properties, copy))
    change = true;

  return change;
}

// Match profiles
function profileMatch(profile, match) {
  return (profile.name === match.name &&
    profile.version === match.version);
}

// Locate profile in node
function profileLocate(node, name, version, role, id) {
  // Scan profiles
  const scan = node.profiles || [];

  for (const profile of scan) {
    // Found profile?
    if (profile.name === name && profile.version === version &&
      profile[role] === id)
      return profile;
  }
  return null;
}

// Get profile definition properties
function propertiesGet(profile) {
  // Get profile definition
  const name = profile.name;
  const definition = profiles.getProfile(name);

  if (definition === null) {
    error('connect error: profile ' + name + ' not found');
    return null;
  }

  // Get profile version
  const versions = definition.versions || [];
  const version = profile.version || versions.length;

  const data = versions[version - 1];

  if (data === undefined) {
    error('connect error: profile ' + name + ' version ' + version + ' not found');
    return null;
  }

  // Get version properties
  return data.properties || [];
}

// Add properties to profile
function propertiesAdd(profile, properties, copy) {
  // What profile type?
  const need = (profile.server !== undefined)?null:undefined;
  const from = (copy === undefined)?null:(copy.properties || {});

  // Scan properties
  var change = false;

  for (const property of properties) {
    // Valid property type?
    if (property.server === need) {
      // Get profile properties
      const container = profile.properties || {};

      // Get current value
      const name = property.name;
      const current = container[name];

      // Get new value
      var value;

      if (from !== null) value = from[name] || '';
      else if (current === undefined) value = '';

      // Property has changed?
      if (value !== undefined && value !== current) {
        // Set new value
        container[name] = value;
        profile.properties = container;

        change = true;
      }
    }
  }
  return change;
}

// Mark for re-publishing
function republish(id, changes) {
  // Add if not already
  if (!changes.includes(id))
    changes.push(id);
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
exports.exit = exit;

exports.getIdents = getIdents;

exports.getNode = getNode;
exports.setNode = setNode;
