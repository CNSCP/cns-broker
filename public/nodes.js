// node.js - Nodes list
// Copyright 2021 Padi, Inc. All Rights Reserved.

(function() {

// Local data

var client;
var topics;

var selection;

// Main entry point
function main() {
  // Config loaded?
  if (config === undefined)
    problem('Not configured');
  else {
    // Connect to broker
    connect();
    nodes();
  }
}

// Show problem view
function problem(msg) {
  title('Error');
  text('nav h1', 'CNS Broker - ' + msg);

  hide('section[name="nodes"]');
  show('section[name="problem"]');
}

// Connect to broker
function connect() {
  // Construct server uri
  const prot = config.protocol || 'wss';
  const host = config.host;
  const port = (config.port === undefined)?'':(':' + config.port);

  const uri = prot + '://' + getAuth() + host + port;

  debug('<> messages on ' + host + port);
  debug('<> messages root ' + getTopic());

  debug('connecting...');

  var attempts = 0;

  try {
    // Connect client
    client = mqtt.connect(uri)
    // Connection established
    .on('connect', () => {
      debug('<> messages connect ' + client.options.clientId);

      // Initial state
      topics = {};
      update();

      // First attempt?
      if (attempts++ === 0)
        subscribe('#');
    })
    // Topic changed
    .on('message', (topic, message) => {
      // Get id from topic
      const id = getId(topic);

      // Remove topic?
      if (message.length === 0)
        delete topics[id];
      else topics[id] = parse(message);

      debug('>> messages pub ' + id);

      // Update changes
      update();
    })
    // Server broke connection
    .on('disconnect', () => {
      debug('>< messages disconnect');
    })
    // Server went offline
    .on('offline', () => {
      debug('>< messages offline');
    })
    // Client trying to reconnect
    .on('reconnect', () => {
      debug('<< messages reconnect');
    })
    // Client closed
    .on('close', () => {
      debug('>< messages close');
      update();
    })
    // Client terminated
    .on('end', () => {
      debug('>< messages end');
      client = undefined;
    })
    // Failure
    .on('error', (e) => {
      error('client error: ' + e.message);
    });
  } catch(e) {
    error('client error: ' + e.message);
  }
}

// Get server auth
function getAuth() {
  const user = config.user;
  const pass = config.pass;

  if (user === undefined) return '';
  if (pass === undefined) return user + '@';

  return user + ':' + pass + '@';
}

// Subscribe to topic
function subscribe(id) {
  const topic = getTopic(id);
  debug('<< messages sub ' + id);

  client.subscribe(topic, {
    rap: true,
    rh: true
  });
}

// Get topic from id
function getTopic(id) {
  const path = [];

  const root = config.root || '';
  const ident = config.ident || '';
  const name = id || '';

  if (root !== '') path.push(root);
  if (ident !== '') path.push(ident);
  if (name !== '') path.push(name);

  return path.join('/');
}

// Get id from topic
function getId(topic) {
  const path = topic.split('/');

  const root = config.root || '';
  const ident = config.ident || '';

  if (root !== '') path.shift();
  if (ident !== '') path.shift();

  return path.join('/');
}

// Start nodes view
function nodes() {
  // Connect list handlers
  $$('section[name="nodes"] ol').forEach((e) => listen(e, 'click', select));
  $$('section[name="nodes"] #profiles').forEach((e) => listen(e, 'dblclick', external));
}

// Update nodes view
function update() {
  // Broker not connected?
  if (!client.connected) {
    // Show offline
    hide('#online');
    show('#offline');

    return;
  }

  // Build lists
  var contexts = '';
  var nodes = '';
  var profiles = '';
  var connections = '';

  var already = [];

  // For each topic
  for (const topic in topics) {
    // Get node
    const node = topics[topic];

    const context = node.context;
    const name = node.name;
    const scan = node.profiles;

    var attr = ' context="' + context + '"';

    // Add context
    if (!already.includes(context)) {
      contexts += '<li' + attr + '>' + context + '</li>';
      already.push(context);
    }

    // Add node
    attr = ' topic="' + topic + '"' + attr + ' node="' + name + '"';
    nodes += '<li' + attr + '>' + name + '</li>';

    // Has profiles?
    if (scan !== undefined) {
      // For each profile
      for (const profile of scan) {
        // Get details
        const name = profile.name;
        const version = profile.version;
        const type = (profile.server !== undefined)?'S':'C';
        const link = profile.server || profile.client;

        // Need or use?
        if (link === topic) {
          // Add profile
          const ver = (version === undefined)?'':(' v' + version);
          const a = attr + ' profile="' + name + '" type="' + type + '"';

          profiles += '<li' + a + '><span>' + name + ver + '</span><span>' + type + '</span></li>';
        } else {
          // Get connection node
          const node = topics[link];
          const ident = (node === undefined)?('<b>' + link + '</b>'):node.name;

          // Add connection
          const invert = (type === 'S')?'C':'S';
          const a = attr + ' profile="' + name + '" type="' + invert + '" connection="' + link + '"';

          connections += '<li' + a + '>' + ident + '</li>';
        }
      }
    }
  }

  // Set list contents
  html('#contexts', contexts);
  html('#nodes', nodes);
  html('#profiles', profiles);
  html('#connections', connections);

  // Sort lists
  sort('#contexts');
  sort('#nodes');
  sort('#profiles');
  sort('#connections');

  // Filter lists
  filter();

  // Show content
  hide('#offline');
  show('#online');
}

// Sort list elements
function sort(selector) {
  const list = $(selector);
  var sorting;

  do {
    const items = $$(list, 'li');
    const len = items.length - 1;

    sorting = false;

    for (var n = 0; n < len; n++) {
      const a = items[n];
      const b = items[n + 1];

      if (text(a) > text(b)) {
        list.insertBefore(b, a);
        sorting = true;
        break;
      }
    }
  } while (sorting);
}

// Called when list item selected
function select(e) {
  // List item element?
  const element = e.target;
  if (tag(element) !== 'li') return;

  // Get new selection
  selection = {
    topic: attribute(element, 'topic'),
    context: attribute(element, 'context'),
    node: attribute(element, 'node'),
    profile: attribute(element, 'profile'),
    type: attribute(element, 'type'),
    connection: attribute(element, 'connection')
  };

  // Filter new selection
  filter();
}

// Open external link
function external(e) {
  if (selection.profile !== undefined)
    window.open('https://' + config.profiles + '/' + selection.profile);
}

// Filter selection
function filter() {
  // Remove current selection
  $$('section[name="nodes"] li[selected]').forEach((e) => attribute(e, 'selected', null));

  // Hide all list items
  $$('#nodes li').forEach((e) => hide(e));
  $$('#profiles li').forEach((e) => hide(e));
  $$('#connections li').forEach((e) => hide(e));

  // Reset properties lists
  text('#heading1', 'Server');
  text('#heading2', 'Client');

  html('#properties0', '');
  html('#properties1', '');
  html('#properties2', '');

  // No selection?
  if (selection === undefined) return;

  // Get current selection
  const topic = selection.topic;
  const context = selection.context;
  const node = selection.node;
  const profile = selection.profile;
  const type = selection.type;
  const connection = selection.connection;

  // Select context
  if (context === null) return;
  var attr = '[context="' + context + '"]';

  $$('#contexts li' + attr).forEach((e) => attribute(e, 'selected', ''));
  $$('#nodes li' + attr).forEach((e) => show(e));

  // No topic?
  if (topic === null) return;

  // Select node
  if (node === null) return;
  attr = '[topic="' + topic + '"]' + attr + '[node="' + node + '"]';

  $$('#nodes li' + attr).forEach((e) => attribute(e, 'selected', ''));
  $$('#profiles li' + attr).forEach((e) => show(e));

  listProperties('#properties0', topics[topic], ['context', 'name', 'profiles']);

  // Select profile
  if (profile === null) return;
  attr += '[profile="' + profile + '"][type="' + type + '"]';

  $$('#profiles li' + attr).forEach((e) => attribute(e, 'selected', ''));
  $$('#connections li' + attr).forEach((e) => show(e));

  // Swap property headers?
  if (type === 'C') {
    text('#heading1', 'Client');
    text('#heading2', 'Server');
  }

  // Fill profile properties
  listProfile('#properties1', topic, profile, type);

  // Select connection
  if (connection === null) return;
  attr += '[connection="' + connection + '"]';

  $$('#connections li' + attr).forEach((e) => attribute(e, 'selected', ''));

  // Fill connection properties
  const invert = (type === 'S')?'C':'S';
  listProfile('#properties2', connection, profile, invert);
}

// List node properties
function listProperties(selector, properties, ignore) {
  var list = '';

  // Has properties?
  if (properties !== undefined) {
    // Add properties
    for (const name in properties) {
      if (ignore === undefined || !ignore.includes(name))
        list += '<li><h5>' + name + '</h5><p>' + properties[name] + '</p></li>';
    }
  }

  // Set list items
  html(selector, list);
}

// List profile properties
function listProfile(selector, topic, name, type) {
  // Find profile?
  const profile = getProfile(topic, name, type);
  const properties = (profile === null)?undefined:profile.properties;

  // List its properties
  listProperties(selector, properties);
}

// Get profile given topic, name and type
function getProfile(topic, name, type) {
  // Topic exists?
  const node = topics[topic];

  if (node !== undefined) {
    // Has profiles?
    const scan = node.profiles;

    if (scan !== undefined) {
    // Find name and type
    const need = (type === 'S')?'server':'client';

    for (const profile of scan) {
      if (profile.name === name &&
        profile[need] !== undefined)
        return profile;
      }
    }
  }
  return null;
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

// Stringify json packet
function stringify(packet) {
  try {
    return JSON.stringify(packet);
  } catch (e) {
    error('stringify error: ' + e.message);
  }
  return null;
}

// Set document title
function title(page) {
  document.title = page + ' - CNS Broker';
}

// Show element
function show(selector) {
  attribute(selector, 'hidden', null);
}

// Hide element
function hide(selector) {
  attribute(selector, 'hidden', '');
}

// Get element tag
function tag(selector) {
  return property(selector, 'tagName').toLowerCase();
}

// Set element text
function text(selector, value) {
  return property(selector, 'textContent', value);
}

// Set element html
function html(selector, value) {
  return property(selector, 'innerHTML', value);
}

// Set element attribute
function attribute(selector, name, value) {
  const element = $(selector);

  if (value !== undefined) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
  return element.getAttribute(name);
}

// Set element property
function property(selector, name, value) {
  const element = $(selector);

  if (value !== undefined)
    element[name] = value;

  return element[name];
}

// Attach event handler
function listen(selector, name, handler, options) {
  $(selector).addEventListener(name, handler, options);
}

// Run seletor query
function query(parent, selector, all = false) {
  // No parent?
  if (selector === undefined) {
    selector = parent;
    parent = document;
  }

  // Already found?
  if (typeof selector === 'object')
    return selector;

  // Get all?
  return all?
    parent.querySelectorAll(selector):
    parent.querySelector(selector);
}

// Query helper
function $(parent, selector) {
  return query(parent, selector);
}

// Query all helper
function $$(parent, selector) {
  return query(parent, selector, true);
}

// Debug message
function debug(msg) {
  if (config.environment !== 'production')
    console.info(msg);
}

// Error message
function error(msg) {
  console.warn(msg);
}

// Call main
main();

} ());
