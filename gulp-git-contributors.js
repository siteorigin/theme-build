'use strict';

var through = require('through2');
var exec = require('child_process').exec;
var gUtil = require('gulp-util');
var PluginError = require('gulp-util').PluginError;
var File = gUtil.File;
var md5 = require('md5');

var PLUGIN_NAME = "gulp-git-contributors";

function gitContributors(options) {
	options = options || {};

	var contributors = {};

	var saveContribs = function (callback) {
		var target = new File();

		var output = JSON.stringify(contributors, null, '\t');

		if(options.format === 'php') {
			output = '<?php\nreturn json_decode( \'' + output + '\', true );'
		} else {
			options.format = 'json';
		}

		var content = new Buffer(output);
		target.path = 'contributors.' + options.format;
		target.contents = content;

		this.emit('data', target);
		this.emit('end');

		callback();
	};

	// Ignores uncommitted changes.
	var skipCommits = ['0000000000000000000000000000000000000000'];
	if (options.skipCommits && options.skipCommits.length) {
		skipCommits = skipCommits.concat(options.skipCommits);
	}

	var skipBoundary = typeof options.skipBoundary === 'undefined' ? false : options.skipBoundary;

	var extractContribs = function (file, encoding, callback) {
		if (file.isNull()) {
			// nothing to do
			return callback(null, null);
		}

		if (file.isStream()) {
			// file.contents is a Stream - https://nodejs.org/api/stream.html
			this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
		}

		// Using line porcelain format: https://git-scm.com/docs/git-blame#_the_porcelain_format
		// More verbose, but makes parsing easier.
		var contribCmd = 'git blame --line-porcelain ' + file.path;

		// NB! Set maxBuffer to 1000KB to handle larger files.
		exec(contribCmd, {cwd: options.cwd, maxBuffer: 1000 * 1024}, function (error, stdout, stderr) {
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
				var lineContent = match[6].trim();
				if (!lineContent) continue;

				if (skipBoundary && match[5].match(/^boundary$/gm)) continue;

				var index = (skipCommits && skipCommits.length) ? skipCommits.indexOf(match[1]) : -1;
				if (index !== -1) continue;
				var email = options.hideEmails ? md5(match[3]) : match[3];
				var contrib = contributors[email] || {name: match[2], email: email, loc: 0, score: 0};
				contrib.loc++;
				var lineScore = typeof options.scoreFunction === 'function' ? options.scoreFunction(lineContent) : 1;
				// git uses Unix timestamp (in seconds), so need to multiply by 1000 for JS time manipulation (in milliseconds).
				lineScore = typeof options.decayFunction === 'function' ? options.decayFunction(match[4] * 1000, lineScore) : lineScore;
				contrib.score += lineScore;
				contributors[email] = contrib;
			}
			callback(null, null);
		});
	};
	return through.obj(extractContribs, saveContribs);
}

module.exports = gitContributors;
