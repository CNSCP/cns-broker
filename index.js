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
    ['--port', 'number', 'Set server port']
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
    }
  }
});
