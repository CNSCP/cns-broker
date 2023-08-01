// index.js - Broker instance
// Copyright 2021 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const service = require('./src/service.js');
const config = require('./config.json');

// Start services

service.start(config, {
  // Command line flags
  flags: [
    ['--host', 'addr', 'Set server host'],
    ['--port', 'number', 'Set server port'],
    ['--localhost', null, 'Set to localhost']
  ],
  // Process flag
  flag: (flag, value) => {
    // What flag?
    switch(flag) {
      case '--host':
        // Set server host
        service.set('server', 'host', value);
        break;
      case '--port':
        // Set server port
        service.set('server', 'port', value);
        break;
      case '--localhost':
        // Set to localhost
        service.set('messages', 'protocol', 'ws');
        service.set('messages', 'host', 'localhost');
        service.set('messages', 'port', '1881');

        service.set('server', 'host', 'localhost');
        service.set('server', 'port', '8081');
        break;
    }
  }
});
