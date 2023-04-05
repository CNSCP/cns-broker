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

var nodes;

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
    const root = master.config.messages.root || 'nodes';

    app.get('/', (req, res) => status(res));
    app.get('/nodes', (req, res) => getNodes(req, res));
    app.get('/' + root + '/:ident', (req, res) => getNode(req, res));

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

    nodes = undefined;

    debug('-- server service');
    resolve();
  });
}

// Get nodes list
function getNodes(req, res) {
  // Create table
  const idents = nodes.getIdents();
  const root = master.config.messages.root || 'nodes';

  var table = '';

  for (const ident in idents) {
    // Add profile to list
    const location = '<a href="/' + root + '/' + ident + '">View</a>';

    const node = idents[ident];
    const count = Object.keys(node).length;

    table +=
      '<tr>' +
        '<td>' + ident + '</td>' +
        '<td>' + count + '</td>' +
        '<td>' + location + '</td>' +
      '</tr>';
  }

  // Send nodes list
  page(res, 200, 'Nodes - CNS Broker',
    '<nav>' +
      '<h1>CNS Broker</h1>' +
      '<a ripple href="/">Status</a>' +
      '<a ripple selected>Nodes</a>' +
    '</nav>' +
    '<section>' +
      ((table !== '')?
      ('<table>' +
        '<tr>' +
          '<th>Identity</th>' +
          '<th>Nodes</th>' +
          '<th></th>' +
        '</tr>' +
        table +
      '</table>'):
      '<p>No Nodes</p>') +
    '</section>');
}

// Get node list
function getNode(req, res) {
  // Get config
  const ident = req.params.ident;

  const messages = master.config.messages;
  const profiles = master.config.profiles;

  const host = req.hostname;
  const port = messages.proxy || messages.port || '1881';

  const user = messages.user || '';
  const pass = messages.pass || '';
  const root = messages.root || 'nodes';

  const uri = 'https://' + profiles.host + (profiles.path || '');

  const scripts =
    '<script>' +
      "const config = {" +
        "version: '" + master.version() + "', " +
        "environment: '" + master.environment() + "', " +
        "protocol: 'ws', " +
        "host: '" + host + "', " +
        "port: '" + port + "', " +
        "user: '" + user + "', " +
        "pass: '" + pass + "', " +
        "root: '" + root + "', " +
        "ident: '" + ident + "', " +
        "profiles: '" + uri + "'" +
      "};" +
    '</script>' +
    '<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>' +
    '<script src="/nodes.js"></script>';

  // Construct page
  page(res, 200, 'Node - CNS Broker',
    '<nav>' +
      '<h1>CNS Broker</h1>' +
      '<a ripple href="/">Status</a>' +
      '<a ripple href="/nodes">Nodes</a>' +
    '</nav>' +
    '<section name="nodes">' +
      '<center id="offline"><div>' +
        '<mark primary><span>Offline</span></mark>' +
      '</div></center>' +
      '<table hidden grid id="online">' +
      '<tr>' +
        '<th>Context</th>' +
        '<th>Nodes</th>' +
        '<th>Properties</th>' +
        '<th>Profiles</th>' +
        '<th id="heading1">Server</th>' +
        '<th>Connections</th>' +
        '<th id="heading2">Client</th>' +
      '</tr>' +
      '<tr>' +
        '<td><ol id="contexts"></ol></td>' +
        '<td><ol id="nodes"></ol></td>' +
        '<td><ul id="properties0"></ul></td>' +
        '<td><ol id="profiles"></ol></td>' +
        '<td><ul id="properties1"></ul></td>' +
        '<td><ol id="connections"></ol></td>' +
        '<td><ul id="properties2"></ul></td>' +
      '</tr>' +
      '</table>' +
    '</section>' +
    '<section hidden name="problem">' +
      '<p>Most likely causes:</p>' +
      '<ul>' +
        "<li>There might be a typing error in the page's URL</li>" +
        '<li>The page may have been removed or had its URL changed</li>' +
        '<li>The page may be temporarily offline</li>' +
      '</ul>' +
    '</section>',
    scripts);
}

// Send status response
function status(res) {
  // Send status page
  page(res, 200, 'Status - CNS Broker',
    '<nav>' +
      '<h1>CNS Broker</h1>' +
      '<a ripple selected>Status</a>' +
      '<a ripple href="/nodes">Nodes</a>' +
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
function page(res, status, title, body, scripts) {
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
      (scripts || '') +
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
exports.start = start;
exports.run = run;
exports.term = term;
exports.exit = exit;
