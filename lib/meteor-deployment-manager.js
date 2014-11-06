#!/usr/bin/env node

/*
 * meteor-deployment-manager
 * https://github.com/chriswessels/meteor-deployment-manager
 *
 * Copyright (c) 2013 Chris Wessels
 * Licensed under the MIT license.
 */

'use strict';

/* Define mdm namespace */
var mdm = {};

/* Get VERSION from package.json */
var VERSION = require('../package.json').version || "UNKNOWN";

/* Require dependencies in mdm namespace */
mdm.requires = {
  child: require('child_process'),
  ssh2: require('ssh2'),
  underscore: require('underscore'),
  winston: require('winston'),
  fs: require('fs-extra')
};
/* Setup underscore and logger global variables */
var _ = mdm.requires.underscore;
var logger = mdm.logger = mdm.requires.winston;
mdm.ssh = new mdm.requires.ssh2();

logger.info("Meteor Deployment Manager v" + VERSION + " loading at " + new Date().toString() + "...");

/* Allowed Command Line Commands and Options */
mdm.cmdArgs = {};
mdm.cmdArgs.allowed = {};
mdm.cmdArgs.allowed.commands = {
  'deploy': {
    help: 'Deploy the specified project to the remote server defined in the deployment configuration file.'
  },
  'generate': {
    help: 'Generate a sample deploy.json file in the current working directory.'
  },
  'rollback': {
    help: 'Roll back the current deployment to the previously deployed build.'
  },
  'start': {
    help: 'Start your application using Upstart.'
  },
  'stop': {
    help: 'Stop your application using Upstart.'
  },
  'restart': {
    help: 'Restart your application using Upstart.'
  }
};
mdm.cmdArgs.allowed.options = {
  '--help,-h': {
    help: 'Use this argument to print out this help text.',
    option: 'help'
  },
  '--verbose,-v,--trace': {
    help: 'Use this argument for verbose logging to the console.',
    option: 'verbose'
  },
  '--project-path,-p': {
    help: "The path to your project. If not specified, the current working directory will be assumed.",
    option: 'projectPath'
  },
  '--config-file,-c': {
    help: 'The file name of your deployment configuration file. Defaults to deploy.json.',
    option: 'configFilename'
  },
  '--environment,-e': {
    help: 'The environment that should be deployed to. Defaults to staging.',
    option: 'environment'
  }
};

/* FUNCTION DEFINITIONS BELOW */

mdm.cmdArgs.provided = {
  engine: process.argv[0],
  path: process.argv[1],
  command: process.argv[2],
  options: process.argv.slice(3)
};

mdm.exitProcess = function () {
  if (VERBOSE) { logger.info('Meteor Deployment Manager exiting at ' + new Date().toString() + '.'); }
  process.exit();
};

mdm.processConfig = function (unprocessedConfig, configFilename) {
  try {
    var processedConfig = {
      environments: {},
      git: {}
    };

    if (!unprocessedConfig.options) { throw { message: configFilename + " does not include any project options." }; }
    if (!unprocessedConfig.environments) { throw { message: configFilename + " does not include any environments." }; }

    if (!unprocessedConfig.options.meteorite && !unprocessedConfig.options.meteorRelease) { throw { message: "If you are not using Meteorite, you must specify a release of Meteor to bundle with." }; }

    _(unprocessedConfig.environments).map(function (value, index, collection) {
      if (!value.hostname) { throw { message: "The '" + index + "' environment does not include a hostname." }; }
      if (!value.port) { value.port = 22; }
      if (!value.username) { throw { message: "The '" + index + "' environment does not include a username." }; }
      if (!value.deploymentDirectory) { throw { message: "The '" + index + "' environment does not include a deployment directory." }; }
      if (!value.taskName) { throw { message: "The '" + index + "' environment does not include a task name." }; }
      if (!value.gitBranch) { value.gitBranch = 'master'; }
      if (!value.buildsToKeep) { value.buildsToKeep = 5; }
      processedConfig.environments[index] = _(value).pick('hostname', 'port', 'username', 'password', 'privateKey', 'deploymentDirectory', 'taskName', 'gitBranch');
    });

    processedConfig.options = _(unprocessedConfig.options).pick('meteorite', 'insecure', 'meteorRelease', 'buildsToKeep');

    return processedConfig;
  } catch (exception) {
    mdm.die('An exception was encountered when attempting to process ' + configFilename + '.', exception.message);
  }
};

mdm.processCmdArgs = function () {
  var allAllowed = [];
  var cmdOptions = {};
  var command = mdm.cmdArgs.provided.command || 'noneProvided';
  var allAllowedGrouped = _.map(_.keys(mdm.cmdArgs.allowed.options), function (value, index, collection) {
    var output = {};
    var args = (value.indexOf(',') !== -1) ? value.split(',') : [value];
    if (args.indexOf(command) !== -1){
      command = 'noneProvided';
    }
    output[value] = args;
    allAllowed = allAllowed.concat(args);
    return output;
  }).forEach(function (value, index, collection) {
    var key = Object.keys(value)[0];
    var intersect = _.intersection(mdm.cmdArgs.provided.options, value[key]);
    if (intersect.length > 0) {
      var followingArgs = [];
      var brake = false;
      var i = false;
      while (brake === false) {
        if (i === false) {
          i = mdm.cmdArgs.provided.options.indexOf(intersect[0]);
        }
        i++;
        if (i > mdm.cmdArgs.provided.options.length) {
          brake = true;
        }
        var nextArg = mdm.cmdArgs.provided.options[i];
        if (allAllowed.indexOf(nextArg) !== -1) {
          brake = true;
        } else {
          followingArgs.push(nextArg);
        }
      }
      cmdOptions[mdm.cmdArgs.allowed.options[key].option] = _.compact(followingArgs);
    }
  });

  var output = {
    options: cmdOptions,
    command: {}
  };
  output.command[command] = true;
  return output;
}

mdm.startEngines = function () {
  /* We need to load the deployment configuration file */
  var configFilename = mdm.cmdOptions.options.configFilename ? mdm.cmdOptions.options.configFilename[0] : 'deploy.json';

  if (mdm.cmdOptions.options.projectPath && mdm.cmdOptions.options.projectPath[0]) {
    if (mdm.cmdOptions.options.projectPath[0].substring(0, 1) !== '/'){
      mdm.cmdOptions.options.projectPath[0] = process.cwd() + '/' + mdm.cmdOptions.options.projectPath[0];
    }
    var projectConfigPath = mdm.cmdOptions.options.projectPath[0] + "/" + configFilename || process.cwd() + "/" + configFilename;
  } else {
    var projectConfigPath = process.cwd() + "/" + configFilename;
  }

  projectConfigPath = projectConfigPath.replace(/\/+/g, '/');

  if (VERBOSE) { logger.info('Deployment configuration file path:', projectConfigPath); }

  var exists = mdm.requires.fs.existsSync(projectConfigPath)

  if (VERBOSE) { logger.info('Checking for existence of ' + configFilename + '...', exists); }
  if (!exists){
    logger.error('Deployment configuration file not found at:', projectConfigPath);
    mdm.exitProcess();
  }
  if (VERBOSE) { logger.info('Now requiring and processing ' + configFilename + '...'); }
  try {
    var unprocessedConfig = require(projectConfigPath);
  } catch (exception) {
    mdm.die('An exception was encountered when attempting to require ' + configFilename + '.', exception.message);
  }
  mdm.processedConfig = mdm.processConfig(unprocessedConfig, configFilename);
  logger.info(projectConfigPath + ' processed successfully.');
  if (VERBOSE) {
    logger.info('Processed configuration: ' + JSON.stringify(mdm.processedConfig));
  }

  var environment = mdm.cmdOptions.options.environment ? mdm.cmdOptions.options.environment[0] : 'staging';

  if (!mdm.processedConfig.environments[environment]) {
    logger.error("The '" + environment + "' environment does not exist in " + configFilename);
    mdm.exitProcess();
  }

  mdm.currentEnvironment = mdm.processedConfig.environments[environment];

  mdm.sshConfiguration = {
    host: mdm.currentEnvironment.hostname,
    port: mdm.currentEnvironment.port,
    username: mdm.currentEnvironment.username,
    tryKeyboard: true
  };

  if(typeof mdm.currentEnvironment.password !== 'undefined') {
    mdm.sshConfiguration.password = mdm.currentEnvironment.password;
  } else if(typeof mdm.currentEnvironment.privateKey !== 'undefined') {
    if (VERBOSE) { logger.info("Private key path: " + mdm.currentEnvironment.privateKey); }
    mdm.sshConfiguration.privateKey = mdm.requires.fs.readFileSync(mdm.currentEnvironment.privateKey);
  }
}

mdm.startDeploy = function () {
  mdm.startEngines();

  var timestamp = Date.parse(new Date());

  var commands = [];
  if (VERBOSE) {
    commands.push({ cmd: 'echo $PATH', output: 'System PATH: ', quiet: false });
    commands.push({ cmd: 'which node', output: 'Path to Node.js: ', quiet: false });
    commands.push({ cmd: 'which npm', output: 'Path to NPM: ', quiet: false });
  }
  commands.push({ cmd: 'node --version', output: 'Node.js Version: ', quiet: false });
  commands.push({ cmd: 'npm --version', output: 'NPM Version: ', quiet: false });
  commands.push({ cmd: 'cd source && git fetch origin && git checkout ' + mdm.currentEnvironment.gitBranch + ' && git pull origin ' + mdm.currentEnvironment.gitBranch, output: 'Updating: ', quiet: false });
  commands.push({ cmd: 'echo "Removing old builds..." && cd builds && rm -rf `ls -r --ignore=current | tail -n +' + ((parseInt(mdm.processedConfig.options.buildsToKeep, 10) + 1) || 0) + '`', output: 'Cleaning: ', quiet: false });
  commands.push({ cmd: 'echo "Creating new build directory, ' + timestamp + '..." && cd builds && mkdir ' + timestamp, output: 'Preparing: ', quiet: false });
  if (mdm.processedConfig.options.meteorite) {
    commands.push({ cmd: 'cd source && mrt bundle ../working/bundle.tgz', output: 'Bundling: ', quiet: false });
  } else {
    commands.push({ cmd: 'cd source && meteor bundle ../working/bundle.tgz --release ' + mdm.processedConfig.options.meteorRelease, output: 'Bundling: ', quiet: false });
  }
  commands.push({ cmd: 'echo "Now extracting bundle.tgz..." && cd working && tar xf bundle.tgz -C ../builds/' + timestamp, output: 'Extracting: ', quiet: false });
  commands.push({ cmd: 'echo "Resetting symbolic link for latest build..." && cd builds && rm -f current && ln -s ' + timestamp + ' current', output: 'Preparing: ', quiet: false });
  // Fixing up line to allow for 0.9^
  if (!mdm.processedConfig.options.meteorite && parseFloat(mdm.processedConfig.options.meteorRelease) > 0.9) {
    commands.push({ cmd: 'echo "Meteor Package System Enabled - Updating NPM Dependencies..." && cd builds/current/bundle/programs/server && npm install', output: 'Pre-Processing: ', quiet: false });
  }
  commands.push({ cmd: 'echo "Restarting Node.js via Upstart..." && sudo restart ' + mdm.currentEnvironment.taskName, output: 'Restarting: ', quiet: false });

  mdm.commandsToRun = commands;

  logger.info('Connecting to ' + mdm.currentEnvironment.hostname + '...');

  mdm.ssh.connect(mdm.sshConfiguration);
}

mdm.startRollback = function () {
  mdm.startEngines();

  var commands = [];

  commands.push({ cmd: 'echo "Rolling back symbolic link..." && cd builds && rm -f current && ln -s `ls -r --ignore=current | head -n 2 | tail -n 1` current', output: '', quiet: false });
  commands.push({ cmd: 'echo "Removing latest build..." && cd builds && rm -rf `ls -r --ignore=current | head -n 1`', output: 'Cleaning: ', quiet: false });
  commands.push({ cmd: 'echo "Restarting Node.js via Upstart..." && sudo restart ' + mdm.currentEnvironment.taskName, output: 'Restarting: ', quiet: false });

  mdm.commandsToRun = commands;

  logger.info('Connecting to ' + mdm.currentEnvironment.hostname + '...');

  mdm.ssh.connect(mdm.sshConfiguration);
}

mdm.startStart = function () {
  mdm.startEngines();

  var commands = [
    { cmd: 'sudo start ' + mdm.currentEnvironment.taskName, output: 'Starting: ', quiet: false }
  ];

  mdm.commandsToRun = commands;

  logger.info('Connecting to ' + mdm.currentEnvironment.hostname + '...');

  mdm.ssh.connect(mdm.sshConfiguration);
}

mdm.startStop = function () {
  mdm.startEngines();

  var commands = [
    { cmd: 'sudo stop ' + mdm.currentEnvironment.taskName, output: 'Stopping: ', quiet: false }
  ];

  mdm.commandsToRun = commands;

  logger.info('Connecting to ' + mdm.currentEnvironment.hostname + '...');

  mdm.ssh.connect(mdm.sshConfiguration);
}

mdm.startRestart = function () {
  mdm.startEngines();

  var commands = [
    { cmd: 'sudo restart ' + mdm.currentEnvironment.taskName, output: 'Restarting: ', quiet: false }
  ];

  mdm.commandsToRun = commands;

  logger.info('Connecting to ' + mdm.currentEnvironment.hostname + '...');

  mdm.ssh.connect(mdm.sshConfiguration);
}

mdm.die = function (context, error) {
  logger.error(context.red);
  logger.error('Message:'.red, error);
  mdm.exitProcess();
}

mdm.runCommandLoop = function (commands, index) {
  var value = commands[index];
  var cmdToExecute = 'cd ' + mdm.currentEnvironment.deploymentDirectory + ' && ' + value.cmd;
  if (VERBOSE) { logger.info('Now executing: ' + cmdToExecute); }
  mdm.ssh.exec(cmdToExecute, function (error, stream) {
    if (error) {
      mdm.ssh.end();
      mdm.die('An error occured while attempting to execute ' + value.cmd + ' on ' + mdm.currentEnvironment.hostname, error);
    }
    stream.on('exit', function (code, signal) {
      if (code !== 0) {
        mdm.ssh.end();
        mdm.die('An error occured while attempting to execute ' + value.cmd + ' on ' + mdm.currentEnvironment.hostname, value.cmd + " exited with code " + code + ".");
      }
      if (VERBOSE) { logger.info(value.cmd + " exited with code " + code + "."); }
      var nextIndex = index + 1;
      /* Run next command */
      if (commands[nextIndex]){
        return mdm.runCommandLoop(commands, nextIndex);
      } else {
        logger.info('No further commands to be run.'.green);
        mdm.ssh.end();
        mdm.exitProcess();
      }
    });
    stream.on('data', function (data, extended) {
      if (VERBOSE && value.quiet || !value.quiet) {
        logger.info(value.output + data.toString().replace(/(^\s*)|(\s*$)/g,''));
      }
    });
  });
}

/* And, let's get kicked off! */

/* Process the command line arguments and make them available globally via the mdm namespace */
mdm.cmdOptions = mdm.processCmdArgs();

var VERBOSE = mdm.cmdOptions.options.verbose;

if (VERBOSE) {
  logger.info("Loaded in directory:", process.cwd());
  logger.info("Parsed command line input: " + JSON.stringify(mdm.cmdOptions));
}

if (mdm.cmdOptions.options.help || mdm.cmdOptions.command.noneProvided) {
  logger.info("================================");
  logger.info("Usage: mdm [command] [options]");
  logger.info("Commands:");
  _(mdm.cmdArgs.allowed.commands).map(function (value, index, collection) {
    logger.info(index.replace(',', ', ').yellow);
    logger.info(value.help);
  });
  logger.info("================================");
  logger.info("Options:");
  _(mdm.cmdArgs.allowed.options).map(function (value, index, collection) {
    logger.info(index.replace(',', ', ').yellow);
    logger.info(value.help);
  });
  logger.info("================================");
  mdm.exitProcess();
} else if (mdm.cmdOptions.command.generate) {
  var newPath = process.cwd() + '/deploy.json';
  var sampleJson = require('./sample_deploy.json');
  mdm.requires.fs.writeJson(newPath, sampleJson, function(error) {
    if (error) {
      mdm.die('An exception was encountered when attempting to create: ' + newPath, error);
    } else {
      mdm.logger.info((newPath + ' was created successfully.').green);
      mdm.exitProcess();
    }
  });
} else if (mdm.cmdOptions.command.rollback) {
  mdm.startRollback();
} else if (mdm.cmdOptions.command.deploy) {
  mdm.startDeploy();
} else if (mdm.cmdOptions.command.start) {
  mdm.startStart();
} else if (mdm.cmdOptions.command.stop) {
  mdm.startStop();
} else if (mdm.cmdOptions.command.restart) {
  mdm.startRestart();
}

/* SSH Callbacks */
mdm.ssh.on('connect', function () {
  logger.info('Connected to ' + mdm.currentEnvironment.hostname + '.');
});
mdm.ssh.on('ready', function () {
  if (VERBOSE) { logger.info('Connection ready for input at ' + new Date().toString() + "..."); }

  var commands = mdm.commandsToRun;

  mdm.runCommandLoop(commands, 0);
});
mdm.ssh.on('error', function (error) {
  logger.error('A connection error was encountered:'.red, error);
  mdm.exitProcess();
});
mdm.ssh.on('end', function () {
  if (VERBOSE) { logger.info('Connection ended.'); }
});
mdm.ssh.on('close', function (hadError) {
  logger.info('Connection closed reporting ' + (hadError ? 'failure' : 'success') + '.');
});
// mdm.ssh.on('keyboard-interactive', function (name, instructions, lang, prompts, finish) {
//   logger.info('Connection entered keyboard-interactive mode.');
//   logger.info(instructions);
//   logger.info(prompts);
// });
