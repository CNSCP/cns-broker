// server.js - Server service
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const express = require('express');
const compression = require('compression');

// Exceptions

const E_NOTFOUND = exception(404, 'Not found');

// Local data

var master;
var config;

var app;
var server;

var started = new Date();
var used = new Date();

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

    // Get config
    app.get('/config.js', (req, res) => getConfig(res));

    // Serve public
    if (config.public !== undefined)
      config.public.split(',').forEach((root) => app.use(express.static(root)));

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
    "environment: '" + capitalize(master.environment()) + "', " +
    "protocol: '" + messages.protocol + "', " +
    "host: '" + messages.host + "', " +
    "port: '" + messages.port + "', " +
    "started: '" + toDateTime(started) + "', " +
    "used: '" + toTimeAgo(used) + "'," +
    "status: 'Running'" +
	"};");

  // Set last used
  used = new Date();
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
}

// Create exception
function exception(status, message) {
  // Create error with status
  const e = new Error(message);
  e.status = status;

  return e;
}

// Return formatted date
function toDate(date) {
	// Get date details
	const day = date.getDate();
	const month = date.toLocaleString('en-us', {month: 'long'});
	const year = date.getFullYear();

	return '' + day + ' ' + month + ' ' + year;
}

// Return formatted time
function toTime(date) {
	// Get time details
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var seconds = date.getSeconds();

	const am = (hours <= 12);
	const ampm = am?'am':'pm';

	if (!am) hours -= 12;

	if (minutes < 10) minutes = '0' + minutes;
	if (seconds < 10) seconds = '0' + seconds;

	return '' + hours + ':' + minutes + ampm;
}

// Return formatted date and time
function toDateTime(date) {
	return toDate(date) + ' at ' + toTime(date);
}

// Return elapsed time from date
function toTimeAgo(date) {
	const seconds = Math.floor((new Date() - date) / 1000);

	var interval;
	var measure;

	if ((interval = Math.floor(seconds / 31536000)) >= 1) measure = 'year';
	else if ((interval = Math.floor(seconds / 2592000)) >=1) measure = 'month';
	else if ((interval = Math.floor(seconds / 86400)) >= 1) measure = 'day';
	else if ((interval = Math.floor(seconds / 3600)) >= 1) measure = 'hour';
	else if ((interval = Math.floor(seconds / 60)) >= 1) measure = 'minute';
	else if ((interval = seconds) >= 1) measure = 'second';
	else return 'Just now';

	if (interval !== 1)
		measure += 's';

	return interval + ' ' + measure + ' ago';
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
