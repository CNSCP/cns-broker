// server.js - Server service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const express = require('express');
const compression = require('compression');

const date = require('./date');

// Exceptions

const E_NOTFOUND = exception(404, 'Not found');

// Local data

var master;
var config;

var app;
var server;

var started = date.now();
var used = date.now();

// Local functions

// Init service
function init(service, section) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Keep master
    master = service;
    config = section;

    // Initialize express
    app = express();

    // Kubernetes health check endpoint
    app.get('/healthz', (req, res) => {
      res.send('Healthy');
    });

    // Request debug?
    if (master.config.output === 'verbose') {
      // Insert wedge
      app.use((req, res, next) => {
        debug('>> server ' + req.method + ' ' + req.path);
        res.on('finish', () => debug('<< server ' + res.statusCode + ' ' + res.statusMessage));

        next();
      });
    }

    // Using compression
    if (config.compress !== undefined)
      app.use(compression());

    // Status request
    app.get('/', (req, res) => status(res));

    // Get config
    app.get('/config.js', (req, res) => getConfig(res));

    // Serve public
    const pub = config.public;

    if (pub !== undefined)
      pub.split(',').forEach((root) => app.use(express.static(root)));

    // All other requests
    app.use((req, res) => fail(res, E_NOTFOUND));

    debug('++ server service');
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
    server = app.listen(port, host, () => {
      debug('<> server on ' + host + ':' + port);
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
    // Close server?
    if (server !== undefined) {
      debug('>< server closed');
      server.close();
    }

    resolve();
  });
}

// Exit service
function exit() {
  // I promise to
  return new Promise((resolve, reject) => {
    // Destroy objects
    app = undefined;
    server = undefined;

    debug('-- server service');
    resolve();
  });
}

// Send config response
function getConfig(res) {
  // Construct response
  const messages = master.config.messages;

  res.setHeader("Content-Type", 'text/javascript');

  response(res, 200, "const config = {" +
    "version: '" + master.version() + "', " +
    "environment: '" + master.environment() + "', " +
    "protocol: 'wss', " +
    "user: '" + messages.user + "', " +
    "pass: '" + messages.pass + "', " +
    "host: '" + messages.host + "', " +
    "port: '" + messages.port + "', " +
    "profiles: '" + master.config.profiles.domain + "', " +
    "started: '" + date.toDateTime(started) + "', " +
    "used: '" + date.toTimeAgo(used) + "', " +
    "status: 'running'" +
  "};");
}

// Send status response
function status(res) {
  // Send status page
  page(res, 200, 'Status - CNS Broker',
    '<nav>' +
      '<h1>CNS Broker</h1>' +
      '<a ripple selected>Status</a>' +
      '<a ripple href="/nodes/">Nodes</a>' +
    '</nav>' +
    '<section>' +
      '<table>' +
        '<tr><th>Version</th><td>' + master.version() + '</td></tr>' +
        '<tr><th>Environment</th><td>' + capitalize(master.environment()) + '</td></tr>' +
        '<tr><th>Started</th><td>' + date.toDateTime(started) + '</td></tr>' +
        '<tr><th>Used</th><td>' + date.toTimeAgo(used) + '</td></tr>' +
        '<tr><th>Status</th><td>Running</td></tr>' +
      '</table>' +
    '</section>');
}

// Send fail response
function fail(res, e) {
  // Must be error
  const status = e.status || 500;
  const internal = (status === 500);

  const message = internal?'Internal error':e.message;

  // Internal error?
  if (internal) {
    error(e.message);
    debug(e.stack);
  }

  // Send error page
  page(res, status, 'Error - CNS Broker',
    '<nav>' +
      '<h1>CNS Broker - ' + message + '</h1>' +
      '<a ripple href="/">Status</a>' +
      '<a ripple href="/nodes/">Nodes</a>' +
    '</nav>' +
    '<section>' +
      '<p>Most likely causes:</p>' +
      '<ul>' +
        '<li>There might be a typing error in the page\'s URL</li>' +
        '<li>The page may have been removed or had its URL changed</li>' +
        '<li>The page may be temporarily offline</li>' +
      '</ul>' +
    '</section>');
}

// Send page response
function page(res, status, title, body) {
  // Construct page
  response(res, status,
    '<!doctype html>' +
    '<html lang="en">' +
      '<head>' +
        '<meta name="description" content="CNS Broker">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<link type="text/css" rel="stylesheet" href="/main.css"/>' +
        '<title>' + title + '</title>' +
      '</head>' +
      '<body>' + body + '</body>' +
    '</html>');
}

// Send response
function response(res, status, body) {
  // Set status and send body
  res.status(status).send(body);
  used = date.now();
}

// Create exception
function exception(status, message) {
  // Create error with status
  const e = new Error(message);
  e.status = status;

  return e;
}

// Caps first letter
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
exports.run = run;
exports.term = term;
exports.exit = exit;
