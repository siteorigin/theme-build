'use strict';

var through = require('through2');
var exec = require('child_process').exec;
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = gutil.File;

function gitcontribs(options) {

  var contributors = {};

  var saveContribs = function(callback, arg2, arg3) {
    var target = new File();

    var content = new Buffer(JSON.stringify(contributors, null, 2));

    target.path = 'contributors.txt';
    target.contents = content;

    this.emit('data', target);
    this.emit('end');
  };

  var extractContribs = function(file, encoding, callback) {
    // Using line porcelain format: https://git-scm.com/docs/git-blame#_the_porcelain_format
    // More verbose, but makes parsing easier.
    var contribCmd = 'git blame --line-porcelain ' + file.path;

    // NB! Set maxBuffer to 1000Kb to handle large files. TODO: Investigate using child_process.spawn instead of exec.
    exec(contribCmd, {cwd:options.cwd, maxBuffer:1000*1024}, function(error, stdout, stderr) {
      var blameRegex = new RegExp(
        '^([a-fA-F0-9]*)(?:\\s\\d+){2,3}\\n' +   // Commit hash followed by original and final line numbers and number of lines in this commit group, if there is one
        '^author (.*)\\n' +                     // Author name
        '^author-mail <(.*)>\\n' +              // Author email
        '^author-time (\\d+)\\n' +              // Author time (in ms)
        '([\\w\\W]*?)\\n' +                       // Should lazily match anything until...
        '^\\t(.*)',                            // ... a line beginning with a tab followed by the line contents.
        'gm'
      );

      var match;
      while (match = blameRegex.exec(stdout)) {
        var boundary = match[5].match(/^boundary$/gm);
        var lineContent = match[6].trim();
        if(!boundary && lineContent) {
          var contrib = contributors[match[2]] || {name:match[2], email:match[3], loc:0};
          contrib.loc++;
          contributors[match[2]] = contrib;
        }
      }
      // Don't return files else they are copied to the directory passed to dest. Output is the contributors.txt file.
      // TODO: I think this means streaming ends. i.e. no pipe calls can be used after this one.
      callback(null, null);
    });
  };
  return through.obj(extractContribs, saveContribs);
}

module.exports = gitcontribs;