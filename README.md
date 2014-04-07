#meteor-deployment-manager
Meteor Deployment Manager (or MDM for short) is a command line tool intended to automate the process of deploying your [Meteor](http://www.meteor.com/) applications to self-hosted infrastructure like Amazon EC2.

**NB: You have found this project in its infancy. The best documentation at the moment is the [source code](https://github.com/chriswessels/meteor-deployment-manager/blob/master/lib/meteor-deployment-manager.js), so check it out!**

##Features
- Written in pure JavaScript.
- Installs as a global NPM package, accessible from any directory.
- Supports multiple deployment environments and configurations.
- Supports the use of Meteor's [Meteorite](https://github.com/oortcloud/meteorite) package manager.
- Supports predefined password, private key and keyboard-interactive authentication.
- Keeps a specifiable number of builds.
- Uses symbolic links to retain build history and allow for instant build rollbacks.
- Uses [Upstart](http://upstart.ubuntu.com) to monitor Node.js.

##How it works

MDM makes itself available with the `mdm` command line program. By default, it looks for a deployment configuration file named `deploy.json` in the current working directory. You can change this behaviour with the `--project-path` and `--config-file` command line options.

Usage:

```text
$ mdm [command] [options]
```

For a full list of available command line options, please execute `mdm --help`.

###1. mdm deploy

The `deploy` command is used to deploy changes you have made to a remote server.

It performs the following operations:

1. Opens an SSH connection to the remote server.
1. Updates the project source via Git.
1. Cleans old builds (specify how many to keep using the `buildsToKeep` configuration option).
1. Creates a new build directory.
1. Uses `meteor` or `mrt` (if you're using Meteorite) to bundle the latest source into a tarball.
1. Extracts the tarball into the latest build directory.
1. Resets `current` symbolic link to latest build directory.
1. Restarts the Node.js process associated with the project.


###2. mdm rollback

The `rollback` command is used to roll back an erroneous deployment.

It performs the following operations:

1. Opens an SSH connection to the remote server.
1. Resets the `current` symbolic link to the second most recent build directory
1. Restarts the Node.js process associated with the project.

###3. mdm generate

The `generate` command is used to create a sample `deploy.json` file in the current working directory. You should customise this file to suit your requirements.

####Sample Deployment Configuration

You can find a sample `deploy.json` file on GitHub: https://github.com/chriswessels/meteor-deployment-manager/blob/master/lib/sample_deploy.json

###4. mdm start

The `start` command is used to start the instance of Node.js associated with your application (via the Upstart script).

###5. mdm stop

The `stop` command is used to stop the instance of Node.js associated with your application (via the Upstart script).

###6. mdm restart

The `restart` command is used to restart the instance of Node.js associated with your application (via the Upstart script).

##Installation

MDM is installed using the [Node Package Manager](https://npmjs.org) command line tool. MDM should be installed with the global flag (-g) to ensure that it is available within any Meteor application directory you might want to deploy.

Install MDM with the following command:

```sh
$ npm install -g meteor-deployment-manager
```

##Project and server requirements

MDM assumes that your project and server set up conforms to a set of requirements:

1. You are using Git as a version control system.
1. You use [Upstart](http://upstart.ubuntu.com) to manage system services on your server.
1. You have [Node.js](http://nodejs.org/), [Meteor](http://www.meteor.com) and [Meteorite](https://github.com/oortcloud/meteorite) installed on your server.
1. Your project source directory (see below) should be a Git repository with an `origin` remote.

###Server directory structure

```text
app_root # This is specified in deploy.json as deploymentDirectory.
app_root/source # This directory contains the source code for your project.
app_root/working # This directory is used as a bundling directory.
app_root/builds # This directory contains the project builds made by MDM.
app_root/builds/timestamp # These directories contain the extracted bundle tarball.
app_root/builds/current # This is a symbolic link to the current build directory.
```

Looking for a guide to set up your server for use with MDM? Look here: [https://gist.github.com/chriswessels/6540167](https://gist.github.com/chriswessels/6540167).

##Contributions

1. Fork this repository.
1. Make your changes, ideally documenting your new code with in-context comments.
1. Submit a pull request with a sane commit message.

##License

The code for this project is released under the MIT License. Please see the `LICENSE` file.
