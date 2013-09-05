#!/usr/bin/env node

/*
 * meteor-deployment-manager
 * https://github.com/chriswessels/meteor-deployment-manager
 *
 * Copyright (c) 2013 Chris Wessels
 * Licensed under the MIT license.
 */

'use strict';

var mdm = {};

var packageJson = require('../package.json');
var VERSION = packageJson.version;

mdm.requires = {
  child: require('child_process'),
  ssh2: require('ssh2'),
  prompt: require('prompt'),
  underscore: require('underscore'),
  winston: require('winston'),
  fs: require('fs')
};
var _ = mdm.requires.underscore;
var logger = mdm.logger = mdm.requires.winston;

logger.info("Meteor Deployment Manager v" + VERSION + " loading at " + new Date().toString() + "...");

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
  }
};

mdm.cmdArgs.provided = {
  engine: process.argv[0],
  path: process.argv[1],
  user: process.argv.slice(2)
};

mdm.exitProcess = function () {
  if (VERBOSE) { logger.info('Meteor Deployment Manager exiting at ' + new Date().toString() + '.'); }
  process.exit();
};

mdm.processConfig = function (unprocessedConfig) {
  try {
    logger.info(unprocessedConfig);
  } catch (exception) {
    logger.error('An exception was encountered when attempting to process ' + configFilename + '.');
    logger.error('Error:', exception.message);
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

mdm.cmdOptions = mdm.processCmdArgs();

var VERBOSE = mdm.cmdOptions.verbose;

if (VERBOSE) {
  logger.info("Parsed command line input:", mdm.cmdOptions);
  logger.info("Loaded in directory:", process.cwd());
}

if (mdm.cmdOptions.help) {
  logger.info("================================");
  mdm.exitProcess();
}

var configFilename = mdm.cmdOptions.configFilename ? mdm.cmdOptions.configFilename[0] : 'deploy.json';

var projectConfigPath = mdm.cmdOptions.projectPath ? mdm.cmdOptions.projectPath[0] + "/" + configFilename || process.cwd() + "/" + configFilename : process.cwd() + "/" + configFilename;

if (VERBOSE) { logger.info('Deployment configuration file path:', projectConfigPath); }

mdm.requires.fs.exists(projectConfigPath, function (exists) {
  if (VERBOSE) { logger.info('Checking for existence of ' + configFilename + '...', exists); }
  if (!exists){
    logger.error('Deployment configuration file not found at:', projectConfigPath);
    mdm.exitProcess();
  }
  if (VERBOSE) { logger.info('Now parsing ' + configFilename + '...'); }
  try {
    var unprocessedConfig = require(projectConfigPath);
  } catch (exception) {
    logger.error('An exception was encountered when attempting to require ' + configFilename + '.');
    logger.error('Error:', exception.message);
    mdm.exitProcess();
  }
  var projectConfiguration = processConfig(unprocessedConfig);
});

// var projectConfiguration = require(projectConfigPath);

// var defaultEnvironment = 'staging';

// projectConfiguration.forEach(function (node) {
//   console.log(node);
// });

/* Options */

// var exec = requires.child.exec;
// var c = new requires.ssh2();

// c.on('connect', function() {
//   console.log('Connection :: connect');
// });

// c.on('connect', function() {
//   console.log('Connection :: connect');
// });
// c.on('ready', function() {
//   console.log('Connection :: ready');
//   c.exec('uptime', function(err, stream) {
//     if (err) throw err;
//     stream.on('data', function(data, extended) {
//       console.log((extended === 'stderr' ? 'STDERR: ' : 'STDOUT: ')
//                   + data);
//     });
//     stream.on('end', function() {
//       console.log('Stream :: EOF');
//     });
//     stream.on('close', function() {
//       console.log('Stream :: close');
//     });
//     stream.on('exit', function(code, signal) {
//       console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
//       c.end();
//     });
//   });
// });
// c.on('error', function(err) {
//   console.log('Connection :: error :: ' + err);
// });
// c.on('end', function() {
//   console.log('Connection :: end');
// });
// c.on('close', function(had_error) {
//   console.log('Connection :: close');
// });
// c.connect({
//   host: 'record.com',
//   port: 22,
//   username: 'meteor',
//   password: ''
// });
