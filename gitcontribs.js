'use strict';

var through = require('through2');
var exec = require('child_process').exec;
var gutil = require('gulp-util');
var File = gutil.File;

function gitcontribs(options) {

  var contributors = {};

  var saveContribs = function(callback) {
    var target = new File();

    var content = new Buffer(JSON.stringify(contributors, null, 2));

    target.path = 'contributors.json';
    target.contents = content;

    this.emit('data', target);
    this.emit('end');

    callback();
  };

  var skip = options.skipCommits;
  var extractContribs = function(file, encoding, callback) {
    if (file.isNull()) {
      // nothing to do
      return callback(null, file);
    }

    // Using line porcelain format: https://git-scm.com/docs/git-blame#_the_porcelain_format
    // More verbose, but makes parsing easier.
    var contribCmd = 'git blame --line-porcelain ' + file.path;

    // NB! Set maxBuffer to 1000KB to handle large files. TODO: Investigate using child_process.spawn instead of exec.
    exec(contribCmd, {cwd:options.cwd, maxBuffer:1000*1024}, function(error, stdout, stderr) {
      var blameRegex = new RegExp(
        '^([a-fA-F0-9]*)(?:\\s\\d+){2,3}\\n' +  // Commit hash followed by original and final line numbers and number of lines in this commit group, if there is one
        '^author (.*)\\n' +                     // Author name
        '^author-mail <(.*)>\\n' +              // Author email
        '^author-time (\\d+)\\n' +              // Author time (in ms)
        '([\\w\\W]*?)\\n' +                     // Should lazily match anything until...
        '^\\t(.*)',                             // ... a line beginning with a tab followed by the line contents.
        'gm'
      );

      var match;
      while (match = blameRegex.exec(stdout)) {
        var index = (skip && skip.length) ? skip.indexOf(match[1]) : -1;
        if(index !== -1) continue;

        if(options.skipBoundary && match[5].match(/^boundary$/gm)) {
          continue;
        }

        var lineContent = match[6].trim();
        if(!lineContent) {
          continue;
        }
        var contrib = contributors[match[2]] || {name:match[2], email:match[3], loc:0};
        contrib.loc++;
        contributors[match[2]] = contrib;
      }
      callback(null, file);
    });
  };
  return through.obj(extractContribs, saveContribs);
}

module.exports = gitcontribs;