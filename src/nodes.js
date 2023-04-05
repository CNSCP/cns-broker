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

  // Reconnect them all
  reconnect(ident, nodes);
}

// Reconnect all nodes
function reconnect(ident, nodes) {
  // First instance?
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
    // Reconnect if last in queue
    if (caching > 0) caching--;
    if (caching === 0) connectNodes(ident, nodes);

    return null;
  });
}

// Read profiles into cache
function cacheProfiles(nodes) {
  // Read relevant profiles
  var promises = [];

  for (const id in nodes) {
    // Scan node profiles
    const node = nodes[id];
    const scan = node.profiles;

    if (scan !== undefined) {
      // Scan each profile
      for (const profile of scan) {
        // Have or use profile?
        if (profile.name !== undefined &&
          (profile.server === id || profile.client === id)) {
          // Fetch into cache
          const promise = profiles.cacheProfile(profile.name);
          if (promise !== null) promises.push(promise);
        }
      }
    }
  }
  return Promise.all(promises);
}

// Connect all nodes
function connectNodes(ident, nodes) {
  // Mark changes
  var changes = [];

  for (const id in nodes) {
    // Node has profiles?
    const node = nodes[id];
    const scan = node.profiles;

    if (scan !== undefined) {
      // Scan profiles
      for (const profile of scan) {
        // Have or use profile?
        if (profile.name !== undefined &&
          (profile.server === id || profile.client === id))
          connect(id, node, nodes, profile, changes);
      }
    }
  }

  // Re-publish any changes
  for (const name of changes) {
    const id = {ident: ident, name: name};
    messages.publish(id, nodes[name]);
  }
}

// Connect node
function connect(id, node, nodes, profile, changes) {
  // Get profile definition
  const name = profile.name;
  const definition = profiles.getProfile(name);

  if (definition === null) {
    error('connect error: profile ' + name + ' not found');
    return;
  }

  // Get version
  const index = profile.version || definition.versions.length;
  const version = definition.versions[index - 1];

  if (version === undefined) {
    error('connect error: profile ' + name + ' version ' + index + ' not found');
    return;
  }

  // Get version properties
  const properties = version.properties;

  // Connect server to clients
  if (profile.server === id)
    connectServer(id, node, nodes, profile, name, properties, changes);
}

// Connect server to clients
function connectServer(serverId, server, nodes, profile, name, properties, changes) {
  // Add server properties
  var spub = addProperties(profile, properties);

  // Look for clients
  for (const clientId in nodes) {
    // Ignore this node
    if (clientId !== serverId) {
      // Right context?
      const client = nodes[clientId];

      if (client.context === server.context) {
        // Client has profiles?
        const scan = client.profiles;

        if (scan !== undefined) {
          // Scan client node profiles
          for (const p of scan) {
            // Client profile?
            if (p.name === name && p.client === clientId) {
              // Add client properties
              var cpub = addProperties(p, properties, profile);

              // Client connected?
              var pro = locate(server, name, 'client', clientId);

              if (pro === null) {
                // No, add client connection
                pro = {
                  name: name,
                  client: clientId
                };

                server.profiles.push(pro);
                spub = true;
              }

              // Add server properties to client
              if (addProperties(pro, properties, p))
                spub = true;

              // Server connected?
              var prr = locate(client, name, 'server', serverId);

              if (prr === null) {
                // No, add server connection
                prr = {
                  name: name,
                  server: serverId
                };

                client.profiles.push(prr);
                cpub = true;
              }

              // Add client properties to server
              if (addProperties(prr, properties, profile))
                cpub = true;

              // Republish client node?
              if (cpub) republish(clientId, changes);
            }
          }
        }
      }
    }
  }

  // Republish server node?
  if (spub) republish(serverId, changes);
}

// Locate profile in node
function locate(node, name, type, id) {
  // Node has profiles?
  const scan = node.profiles;

  if (profiles !== undefined) {
    // Scan profiles
    for (const profile of scan) {
      // Found profile?
      if (profile.name === name &&
        profile[type] === id) {
        return profile;
      }
    }
  }
  return null;
}

// Add definition properties to profile
function addProperties(profile, properties, defaults) {
  // Mark if profile changed
  var changed = false;

  // Add property container?
  if (profile.properties === undefined) {
    profile.properties = {};
//    changed = true;
  }

  // Definition has properties?
  if (properties !== undefined) {
    // What profile type?
    const need = (profile.server !== undefined)?null:undefined;
    const values = (defaults === undefined)?{}:(defaults.properties || {});

    // Add properties
    for (const property of properties) {
      // Valid for server or client?
      if (property.server === need) {
        // Get property value
        const name = property.name;

        const value = values[name];
        const current = profile.properties[name];

        // Property is required?
        if (current === undefined && property.required === null) {
          profile.properties[name] = '';
          changed = true;
        }

        // Property has changed?
        if (defaults && value !== current) {
          profile.properties[name] = value;
          changed = true;
        }
      }
    }
  }
  return changed;
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
