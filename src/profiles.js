// profiles.js - Profile service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const https = require('https');

// Local data

var master;
var config;

var profiles;

// Local functions

// Init service
function init(service, section) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Keep master
    master = service;
    config = section;

    profiles = {};

    debug('++ profiles service ' + config.host);
    resolve();
  });
}

// Exit service
function exit() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Destroy objects
    profiles = undefined;

    debug('-- profiles service');
    resolve();
  });
}

// Start profile cache
function cacheStart() {
  // Wipe cache?
  if (!config.cache)
    profiles = {};
}

// Cache profile
function cacheProfile(name) {
  // Exists in cache?
  if (profiles[name] !== undefined)
    return null;

  // Start caching
  profiles[name] = null;

  // I promise to
  return new Promise((resolve, reject) => {
    // Send request
    const host = config.host;
    const path = config.path || '';

    const uri = 'https://' + host + path + '/' + name;

    debug('<< profiles GET ' + name);

    const req = https.get(uri, (res) => {
      // Get status
      const status = res.statusCode;
      const message = res.statusMessage;

      debug('>> profiles ' + status + ' ' + message);

      // Bad status?
      if (status < 200 || status > 299)
        return resolve(false);

      // Collate response
      var chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));

      res.on('end', () => {
        profiles[name] = parse(chunks.join(''));
        resolve(true);
      });
    })
    // Failure
    .on('error', (e) => reject(e));

    // Send it
    req.end();
  });
}

// Get profile definition
function getProfile(name) {
  return profiles[name] || null;
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
exports.exit = exit;

exports.cacheStart = cacheStart;
exports.cacheProfile = cacheProfile;

exports.getProfile = getProfile;
