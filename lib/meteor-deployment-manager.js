#!/usr/bin/env node

/*
 * meteor-deployment-manager
 * https://github.com/chriswessels/meteor-deployment-manager
 *
 * Copyright (c) 2013 Chris Wessels
 * Licensed under the MIT license.
 */

'use strict';

var packageJson = require('../package.json');

var VERSION = packageJson.version;

/* General Setup */
var requires = {
  child: require('child_process'),
  ssh2: require('ssh2'),
  prompt: require('prompt'),
  underscore: require('underscore'),
  winston: require('winston')
};
var _ = requires.underscore;
var logger = requires.winston;

logger.info("Meteor Deployment Manager v" + VERSION + " loading at " + new Date().toString() + "...");


var allowedArgs = {
  '--help,-h': {
    help: 'Use this argument to print out this help text.',
    option: 'help'
  },
  '--verbose,-v': {
    help: 'Use this argument for verbose logging to the console.',
    option: 'verbose'
  }
};


var cmdArgs = {
  engine: process.argv[0],
  path: process.argv[1],
  user: process.argv.slice(2)
};

var allAllowedArgs = [];
var cmdOptions = {};

var allowedArgsGrouped = _.map(_.keys(allowedArgs), function (value, index, collection) {
  var output = {};
  var args = (value.indexOf(',') !== -1) ? value.split(',') : [value];
  output[value] = args;
  allAllowedArgs = allAllowedArgs.concat(args);
  return output;
}).forEach(function (value, index, collection) {
  var key = Object.keys(value)[0];
  var intersect = _.intersection(cmdArgs.user, value[key]);
  if (intersect.length > 0){
    var followingArgs = [];
    var brake = false;
    var i = false;
    while (brake === false){
      if (i === false){
        i = cmdArgs.user.indexOf(intersect[0]);
      }
      i++;
      if (i > cmdArgs.user.length){
        brake = true;
      }
      var nextArg = cmdArgs.user[i];
      if (allAllowedArgs.indexOf(nextArg) !== -1){
        brake = true;
      } else {
        followingArgs.push(nextArg);
      }
    }
    cmdOptions[allowedArgs[key].option] = _.compact(followingArgs);
  }
});

var VERBOSE = cmdOptions.verbose;

if (VERBOSE) logger.info("Parsed command line input:", cmdOptions);

//console.log(cmdOptions);
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