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
var packageJson = require('../package.json');
var VERSION = packageJson.version || "UNKNOWN";

/* Require dependencies in mdm namespace */
mdm.requires = {
  child: require('child_process'),
  ssh2: require('ssh2'),
  prompt: require('prompt'),
  underscore: require('underscore'),
  winston: require('winston'),
  fs: require('fs-extra')
};
/* Setup underscore and logger global variables */
var _ = mdm.requires.underscore;
var logger = mdm.logger = mdm.requires.winston;
mdm.ssh = new mdm.requires.ssh2();

logger.info("Meteor Deployment Manager v" + VERSION + " loading at " + new Date().toString() + "...");

/* Allowed Command Line Arguments */
mdm.cmdArgs = {};
mdm.cmdArgs.allowed = {
  '--help,-h': {
    help: 'Use this argument to print out this help text.',
    option: 'help'
  },
  '--verbose,-v': {
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
  },
  '--generate,-g': {
    help: 'Use this argument to generate a sample deploy.json in the current working directory.',
    option: 'generate'
  }
};

/* FUNCTION DEFINITIONS BELOW */

mdm.cmdArgs.provided = {
  engine: process.argv[0],
  path: process.argv[1],
  user: process.argv.slice(2)
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

    if (!unprocessedConfig.git) { throw { message: configFilename + " does not include any git details." }; }
    if (!unprocessedConfig.environments) { throw { message: configFilename + " does not include any environments." }; }

    _(unprocessedConfig.environments).map(function (value, index, collection) {
      if (!value.hostname) { throw { message: "The '" + index + "' environment does not include a hostname." }; }
      if (!value.port) { value.port = 22; }
      if (!value.username) { throw { message: "The '" + index + "' environment does not include a username." }; }
      processedConfig.environments[index] = value;
    });
    processedConfig.git = _(unprocessedConfig.git).pick('repository', 'username', 'password');

    return processedConfig;
  } catch (exception) {
    logger.error('An exception was encountered when attempting to process ' + configFilename + '.');
    logger.error('Message:', exception.message);
    mdm.exitProcess();
  }
};

mdm.processCmdArgs = function () {
  var allAllowed = [];
  var cmdOptions = {};
  var allAllowedGrouped = _.map(_.keys(mdm.cmdArgs.allowed), function (value, index, collection) {
    var output = {};
    var args = (value.indexOf(',') !== -1) ? value.split(',') : [value];
    output[value] = args;
    allAllowed = allAllowed.concat(args);
    return output;
  }).forEach(function (value, index, collection) {
    var key = Object.keys(value)[0];
    var intersect = _.intersection(mdm.cmdArgs.provided.user, value[key]);
    if (intersect.length > 0){
      var followingArgs = [];
      var brake = false;
      var i = false;
      while (brake === false){
        if (i === false){
          i = mdm.cmdArgs.provided.user.indexOf(intersect[0]);
        }
        i++;
        if (i > mdm.cmdArgs.provided.user.length){
          brake = true;
        }
        var nextArg = mdm.cmdArgs.provided.user[i];
        if (allAllowed.indexOf(nextArg) !== -1){
          brake = true;
        } else {
          followingArgs.push(nextArg);
        }
      }
      cmdOptions[mdm.cmdArgs.allowed[key].option] = _.compact(followingArgs);
    }
  });
  return cmdOptions;
}

mdm.startEngines = function () {
  /* We need to load the deployment configuration file */
  var configFilename = mdm.cmdOptions.configFilename ? mdm.cmdOptions.configFilename[0] : 'deploy.json';

  if (mdm.cmdOptions.projectPath && mdm.cmdOptions.projectPath[0]) {
    if (mdm.cmdOptions.projectPath[0].substring(0, 1) !== '/'){
      mdm.cmdOptions.projectPath[0] = process.cwd() + '/' + mdm.cmdOptions.projectPath[0];
    }
    var projectConfigPath = mdm.cmdOptions.projectPath[0] + "/" + configFilename || process.cwd() + "/" + configFilename;
  } else {
    var projectConfigPath = process.cwd() + "/" + configFilename;
  }

  if (VERBOSE) { logger.info('Deployment configuration file path:', projectConfigPath); }

  mdm.requires.fs.exists(projectConfigPath, function (exists) {
    if (VERBOSE) { logger.info('Checking for existence of ' + configFilename + '...', exists); }
    if (!exists){
      logger.error('Deployment configuration file not found at:', projectConfigPath);
      mdm.exitProcess();
    }
    if (VERBOSE) { logger.info('Now requiring and processing ' + configFilename + '...'); }
    try {
      var unprocessedConfig = require(projectConfigPath);
    } catch (exception) {
      logger.error('An exception was encountered when attempting to require ' + configFilename + '.');
      logger.error('Message:', exception.message);
      mdm.exitProcess();
    }
    mdm.processedConfig = mdm.processConfig(unprocessedConfig, configFilename);
    logger.info(configFilename + ' processed successfully.');
    if (VERBOSE) {
      logger.info('Processed configuration: ' + JSON.stringify(mdm.processedConfig));
    }

    var environment = mdm.cmdOptions.environment ? mdm.cmdOptions.environment[0] : 'staging';

    if (!mdm.processedConfig.environments[environment]) {
      logger.error("The '" + environment + "' environment does not exist in " + configFilename);
      mdm.exitProcess();
    }

    mdm.currentEnvironment = mdm.processedConfig.environments[environment];

    logger.info('Connecting to ' + mdm.currentEnvironment.hostname + '...');

    mdm.ssh.connect({
      host: mdm.currentEnvironment.hostname,
      port: mdm.currentEnvironment.port,
      username: mdm.currentEnvironment.username,
      password: mdm.currentEnvironment.password
    });
  });
}

/* And, let's get kicked off! */

/* Process the command line arguments and make them available globally via the mdm namespace */
mdm.cmdOptions = mdm.processCmdArgs();

var VERBOSE = mdm.cmdOptions.verbose;

if (VERBOSE) {
  logger.info("Loaded in directory:", process.cwd());
  logger.info("Parsed command line input: " + JSON.stringify(mdm.cmdOptions));
}

if (mdm.cmdOptions.help) {
  logger.info("================================");
  _(mdm.cmdArgs.allowed).map(function (value, index, collection) {
    logger.info(("Command(s): " + index.replace(',', ', ')));
    logger.info(value.help);
  });
  logger.info("================================");
  mdm.exitProcess();
} else if (mdm.cmdOptions.generate) {
  var newPath = process.cwd() + '/deploy.json';
  var sampleJson = require('./sample_deploy.json');
  mdm.requires.fs.writeJson(newPath, sampleJson, function(error) {
    if (error) {
      mdm.logger.error('An exception was encountered when attempting to create:', newPath);
      mdm.logger.error('Message:', error);
    } else {
      mdm.logger.info(newPath + ' was created successfully.');
    }
    mdm.exitProcess();
  });
} else {
  mdm.startEngines();
}

/* SSH Callbacks */
mdm.ssh.on('connect', function() {
  logger.info('Connected to ' + mdm.currentEnvironment.hostname + '.');
});
mdm.ssh.on('ready', function() {
  if (VERBOSE) { logger.info('Connection ready for input.'); }
  mdm.ssh.exec('uptime', function(err, stream) {
    if (err) throw err;
    stream.on('data', function(data, extended) {
      console.log((extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ')
                  + data);
    });
    stream.on('end', function() {
      console.log('Stream :: EOF');
    });
    stream.on('close', function() {
      console.log('Stream :: close');
    });
    stream.on('exit', function(code, signal) {
      console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
      mdm.ssh.end();
    });
  });
});
mdm.ssh.on('error', function(error) {
  logger.error('A connection error was encountered:', error);
  mdm.ssh.end();
  mdm.exitProcess();
});
mdm.ssh.on('end', function() {
  if (VERBOSE) { logger.info('Connection ended.'); }
});
mdm.ssh.on('close', function(hadError) {
  logger.info('Connection closed reporting ' + (hadError ? 'failure' : 'success') + '.');
});
