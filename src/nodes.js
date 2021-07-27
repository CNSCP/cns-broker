// nodes.js - Nodes service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Local data

var master;
var config;

var messages;
var profiles;

var nodes;
var caching;

// Local functions

// Init service
function init(service, section) {
	// I promise to
  return new Promise((resolve, reject) => {
		// Keep master
		master = service;
		config = section;

    nodes = {};
    caching = 0;

		debug('++ connect service');
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
		profiles = undefined;
    nodes = undefined;

		debug('-- connect service');
		resolve();
	});
}

// Add node
function addNode(id, node) {
  // Add node entry
  nodes[id] = node;
  reconnect();
}

// Remove node
function removeNode(id) {
  // Remove node entry
  delete nodes[id];
  reconnect();
}

//
function reconnect() {
  // First instance?
  if (caching++ === 0)
    profiles.cacheStart();

  // Resolve profiles
  cacheProfiles()
  // Failure
  .catch((e) => {
    error(e.message);
  })
  // And finally
  .finally((result) => {
    // Reconnect if last in queue
    if (caching > 0) caching--;
    if (caching === 0) connectNodes();

    return null;
  });
}

//
function cacheProfiles() {
  // Read relevant profiles
  var promises = [];

  for (const id in nodes) {
    // Scan node profiles
    const node = nodes[id];
    const scan = node.profiles;

    if (scan !== undefined) {
      // Scan each profile
      for (const profile of scan) {
        //
        if (profile.name !== undefined &&
          (profile.server === id || profile.client === id)) {
          //
          const promise = profiles.cacheProfile(profile.name);
          if (promise !== null) promises.push(promise);
        }
      }
    }
  }
  return Promise.all(promises);
}

//
function connectNodes() {
  //
  var ids = [];

  for (const id in nodes) {
    //
    const node = nodes[id];
    const scan = node.profiles;

    if (scan !== undefined) {
      //
      for (const profile of scan) {
        //
        if (profile.name !== undefined &&
          (profile.server === id || profile.client === id))
          connect(id, node, profile, ids);
      }
    }
  }

  // Re-publish changes
  for (const id of ids)
    messages.publish(id, nodes[id]);
}

//
function connect(id, node, profile, ids) {
  // Get profile definition
  const name = profile.name;
  const definition = profiles.getProfile(name);

  if (definition === null) {
    error('Profile ' + name + ' not found');
    return;
  }

  // Get version
  const index = profile.version || definition.versions.length;
  const version = definition.versions[index - 1];

  if (version === undefined) {
    error('Profile ' + name + ' version ' + index + ' not found');
    return;
  }

  // Get version properties
  const properties = version.properties;

  //
  if (profile.server === id)
    connectServer(id, node, profile, name, properties, ids);

//  if (node.client === id)

}


//
function connectServer(serverId, server, profile, name, properties, ids) {

  console.log('connect clients of ' + name + ' to server ' + serverId + ' under ' + server.context);

  //
  var pub = addProperties(profile, properties);

  //
  for (const id in nodes) {
    //
    if (id !== serverId) {
      //
      const client = nodes[id];

      if (client.context === server.context) {
        //
        const scan = client.profiles;

        if (scan !== undefined) {
          //
          for (const p of scan) {
            //
            if (p.name === name &&
              p.client === id) {

//console.log('found ' + id + ' with ' + name);

var pro = locate(server, name, 'client', id);
if (pro === null) {
  pro = {
    name: name,
    client: id
  };
  server.profiles.push(pro);
  pub = true;

//console.log('adding ' + name + ' client ' + id + ' to ' + serverId);
}

if (addProperties(pro, properties, p))
  pub = true;

//if (addProperties(profile, definition, p) > 0)
//  pub = true;


var xpub = false;
var prr = locate(client, name, 'server', serverId);
if (prr === null) {
  prr = {
    name: name,
    server: serverId
  };
  client.profiles.push(prr);
  xpub = true;
}

if (addProperties(prr, properties, profile))
  xpub = true;

if (addProperties(p, properties, profile))
  xpub = true;


if (xpub) republish(id, ids); //messages.publish(id, client);




            }
          }
        }
      }
    }
  }

  //
  if (pub) {
//nodes[serverId] = server;
    republish(serverId, ids);
//    messages.publish(serverId, server);

//console.log('pub ' + serverId + ' as ' + JSON.stringify(server,null,2));
  }
}

function locate(node, name, type, id) {
  const scan = node.profiles;

  if (profiles !== undefined) {
    for (const profile of scan) {
      if (profile.name === name &&
        profile[type] === id) {
        return profile;
      }
    }
  }
//console.log('not found ' + name + ' ' + type + ' = ' + id);
  return null;
}

// Add properties to profile
function addProperties(profile, properties, defaults) {
  // Mark if profile changed
  var changed = false;

  //
  if (profile.properties === undefined) {
    profile.properties = {};
//    changed = true;
  }

  // Has any properties?
  if (properties !== undefined) {
    //
    const need = (profile.server !== undefined)?null:undefined;
    const values = (defaults === undefined)?{}:(defaults.properties || {});

    //
    for (const property of properties) {
      //
      if (property.server === need && property.required === null) {
        //
        const name = property.name;
        const value = profile.properties[name];

        if (value === undefined) {
          //
          profile.properties[name] = values[name] || '';
          changed = true;
        }
      }
    }
  }
  return changed;
}

// Mark for re-publishing
function republish(id, ids) {
  if (!ids.includes(id))
    ids.push(id);
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

exports.addNode = addNode;
exports.removeNode = removeNode;
