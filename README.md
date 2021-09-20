# CNS Broker

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [License](#license)
- [Copyright notice](#copyright-notice)

## About

`cns-broker` is a [Node.js](https://en.wikipedia.org/wiki/Node.js) application providing an [mqtt](https://en.wikipedia.org/wiki/MQTT) service used to connect `cns-node` modules together using connection profiles. `cns-broker` works on any POSIX-compliant shell (sh, dash, ksh, zsh, bash), in particular on these platforms: unix, linux, macOS, and Windows WSL.

## Docker

This application can be built and run inside of docker. Simply run `docker-compose up` and it will build and run the broker image.

## Installing

To **install** or **update** the `cns-broker`, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/cnscp/cns-broker.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-broker` project directory. Go to the project directory and install Node.js dependancies with:

```sh
npm install
```

Your `cns-broker` should now be ready to rock.

## Usage

Once installed, run the `cns-broker` with:

```sh
npm run start
```

To shut down the `cns-broker`, hit `ctrl-c`.

The status page of `cns-broker` is defaulted to port 4040. Browsing to `localhost:4040` should give you a status page. WebSocket communication happens over port 9001 by default. You can change this from inside of [./config.json](./config.json)

### Environment Variables

* `MQTT_ROOT_TOPIC` => The root topic the MQTT service should connect to. Overrides any other configuration.

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright notice
