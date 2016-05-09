'use strict';

var through = require('through2');
var exec = require('child_process').exec;
var gUtil = require('gulp-util');
var PluginError = require('gulp-util').PluginError;
var File = gUtil.File;
var md5 = require('md5');

var PLUGIN_NAME = "gulp-git-contributors";

module.exports = function (options) {
	options = options || {};

	var contributors = {};

	var saveContribs = function ( callback ) {
		var target = new File();

		var scoreTotal = 0;
		var toSort = [];
		if( Object.keys( contributors ).length > 0 ) {
			for ( var i in contributors ) {
				if( options.excludeEmails && options.excludeEmails.indexOf( contributors[i].email ) !== -1 ) {
					// Skip emails given in the excludeEmails config
					continue;
				}

				// We only need contributors score to 2 decimal places
				contributors[i].score = contributors[i].score;
				scoreTotal += contributors[i].score;
				toSort.push( contributors[i] );
			}
		}

		toSort.sort( function( a, b ){
			return a.score > b.score ? -1 : 1;
		} );

		var toSave = {};
		for( var i = 0; i < toSort.length; i++ ) {
			// Store this contributor's percent contribution with 3 decimal places
			toSort[i].percent = toSort[i].score / scoreTotal * 100;
			toSave[ toSort[i].email ] = toSort[i];
		}

		var output = JSON.stringify( toSave, null, '\t' );

		if(options.format === 'php') {
			output = '<?php\nreturn json_decode( \'' + output + '\', true );';
		} else {
			options.format = 'json';
		}

		var content = new Buffer(output);
		target.path =  ( options.outputPath || '' ) + 'contributors.' + options.format;
		target.contents = content;

		this.emit('data', target);
		this.emit('end');

		callback();
	};

	/**
	 * Score function judges value of each line of code.
	 *
	 * @param line The contents of the line
	 * @param fileExtension The file extension of this file
	 * @returns {number}
	 */
	var codeScorer = require('./score/code-scorer.js');

	/**
	 * Decay function gives contributions a half-life.
	 *
	 * @param date
	 * @param score
	 * @returns {number}
	 */
	var decayFunction = require('./score/decay.js');

	options.codeScorer = options.codeScorer || codeScorer;
	options.decayFunction = options.decayFunction || decayFunction;

	// Ignores uncommitted changes.
	var skipCommits = ['0000000000000000000000000000000000000000'];
	if (options.skipCommits && options.skipCommits.length) {
		skipCommits = skipCommits.concat(options.skipCommits);
	}

	var skipBoundary = typeof options.skipBoundary === 'undefined' ? false : options.skipBoundary;

	var extractContribs = function (file, encoding, callback) {
		if ( file.isNull() ) {
			// nothing to do
			return callback(null, null);
		}

		if ( file.isStream() ) {
			// file.contents is a Stream - https://nodejs.org/api/stream.html
			this.emit('error', new PluginError( PLUGIN_NAME, 'Streams not supported!' ) );
		}

		options.codeScorer.loadFile( file );

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
			var lineNumber = 0;
			while ( match = blameRegex.exec( stdout ) ) {
				var lineContent = match[6].trim();

				// Skip empty lines
				if ( !lineContent ) {
					continue;
				}

				if ( skipBoundary && match[5].match(/^boundary$/gm) ) {
					continue;
				}

				// Check if this is one of the commits we should skip
				if ( skipCommits && skipCommits.length && skipCommits.indexOf( match[1] ) !== -1 ) {
					continue;
				}

				var email = options.hideEmails ? md5( match[3] ) : match[3];
				var contrib = contributors[email] || {name: match[2], email: email, loc: 0, score: 0};
				contrib.loc++;

				// The line score
				var lineScore = 1;
				lineScore = options.codeScorer.scoreLine( lineContent, lineNumber );

				// git uses Unix timestamp (in seconds), so need to multiply by 1000 for JS time manipulation (in milliseconds).
				if( typeof options.decayFunction === 'function' ) {
					lineScore = options.decayFunction( match[4] * 1000, lineScore );
				}

				// Add this score to the contributor score
				if( lineScore > 0 ) {
					contrib.score += lineScore;
				}
				contributors[email] = contrib;

				lineNumber++;
			}
			callback(null, null);
		});
	};
	return through.obj( extractContribs, saveContribs );
}
