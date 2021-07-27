# CNS Broker

## Table of Contents

- [About](#about)
- [Installing](#installing)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [License](#license)
- [Copyright notice](#copyright-notice)

## About

`cns-broker` is an [mqtt](https://en.wikipedia.org/wiki/MQTT) server application used to connect `cns-node` modules together using connection profiles. `cns-broker` works on any POSIX-compliant shell (sh, dash, ksh, zsh, bash), in particular on these platforms: unix, linux, macOS, and Windows WSL.

## Installing

To **install** or **update** the `cns-broker`, you should fetch the latest version from this Git repository. To do that, you may either download and unpack the repo zip file, or clone the repo using:

```sh
git clone https://github.com/PadiInc/cns-broker.git
```

Either method should get you a copy of the latest version. It is recommended (but not compulsory) to place the repo in the `~/cns-broker` project directory. Go to the project directory and install `node` dependancies with:

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

## Maintainers

## License

See [LICENSE.md](./LICENSE.md).

## Copyright notice
