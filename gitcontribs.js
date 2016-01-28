'use strict';

var through = require('through2');
var exec = require('child_process').exec;
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = gutil.File;

function gitcontribs(options) {

  //var saveContribs = function(arg1, arg2, arg3) {
  //  var target = new File();
  //
  //  var content = new Buffer(JSON.stringify(contributors, null, 2));
  //
  //  target.path = 'contributors.txt';
  //  target.contents = content;
  //
  //  this.emit('data', target);
  //  this.emit('end');
  //};

  var extractContribs = function(file, encoding, callback) {
    // Using line porcelain format: https://git-scm.com/docs/git-blame#_the_porcelain_format
    // More verbose, but makes parsing easier.
    var contribCmd = 'git blame --line-porcelain ' + file.path;

    exec(contribCmd, {cwd:options.cwd}, function(error, stdout, stderr) {
      //console.log(stdout);
      var blameRegex = new RegExp(
        '^([a-fA-F0-9]*)(?:\\s\\d+){2,3}\\n' +   // Commit hash followed by original and final line numbers and number of lines in this commit group, if there is one
        '^author (.*)\\n' +                     // Author name
        '^author-mail <(.*)>\\n' +              // Author email
        '^author-time (\\d+)\\n' +              // Author time (in ms)
        '[\\w\\W]*?\\n' +                       // Should lazily match anything until...
        '^[ \\t]+(.*)',                            // ... a line beginning with whitespace followed by the line contents.
        'gm'
      );
      var contributors = {};
      var match;
      while (match = blameRegex.exec(stdout)) {
        var contrib = contributors[match[2]] || {name:match[2], email:match[3], loc:0};
        if(match[5]) {
          contrib.loc++;
        }
        contributors[match[2]] = contrib;
      }
      var contents = new Buffer(JSON.stringify(contributors, null, 2));
      var contribsFile = new File({
        path: file.path,
        contents: new Buffer(contents)
      });
      callback(null, contribsFile);
    });
  }
  //return through.obj(extractContribs, saveContribs);
  return through.obj(extractContribs);
};

module.exports = gitcontribs;