// profiles.js - Profile service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const https = require('https');

// Local data

var master;
var config;

var cache;

// Local functions

// Init service
function init(service, section) {
	// I promise to
  return new Promise((resolve, reject) => {
		// Keep master
		master = service;
		config = section;

    cache = {};

		debug('++ profile service ' + config.domain);
		resolve();
	});
}

// Exit service
function exit() {
	// I promise to
  return new Promise((resolve, reject) => {
		// Destroy objects
    cache = undefined;

		debug('-- profile service');
		resolve();
	});
}

// Start profile cache
function cacheStart() {
  // Wipe cache?
  if (!config.cache)
    cache = {};
}

// Cache profile
function cacheProfile(name) {
  // Exists in cache?
  if (cache[name] !== undefined)
    return null;

  // Start caching
  cache[name] = null;

	// I promise to
  return new Promise((resolve, reject) => {
		// Send request
		const url = 'https://' + config.domain + '/profiles/' + name;

		debug('<< profile GET ' + name);

		const req = https.get(url, (res) => {
			// Get status
			const status = res.statusCode;
      const message = res.statusMessage;

			debug('>> profile ' + status + ' ' + message);

			// Bad status?
			if (status < 200 || status > 299)
        return resolve(false);

			// Collate response
			var chunks = [];

			res.on('data', (chunk) => chunks.push(chunk));

      res.on('end', () => {
        cache[name] = parse(chunks.join(''));
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
  return cache[name] || null;
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
