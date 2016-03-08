var config = require('../build-config.js');
var gulp = require('gulp');
var wpPot = require('gulp-wp-pot');
var sort = require('gulp-sort');
var del = require('del');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var less = require('gulp-less');
var uglify = require('gulp-uglify');
var zip = require('gulp-zip');
var path = require('path');
var gutil = require('gulp-util');

var gitContributors = require('./gulp-git-contributors.js');

var args = {};
if (process.argv.length > 2) {
	var arr = process.argv.slice(2);
	for (var i = 0; i < arr.length; i++) {
		var argName = arr[i];
		if (argName.match(/build:/)) {
			args.target = argName;
		}
		else if (argName.match(/-\w+/i)) {
			args[argName.slice(1)] = arr[i + 1];
		}
	}
}

var catchDevErrors = function (plugin) {
	if (args.target == 'build:dev') {
		plugin.on('error', function (error) {
			gutil.log(error);
			plugin.end();
		});
	}
	return plugin;
};

//Change current working directory to theme root directory.
process.chdir('..');
var themeRoot = process.cwd();
var pathParts = themeRoot.split(path.sep);
var themeSlug = pathParts[pathParts.length - 1];
var outDir = args.target == 'build:dev' ? '.' : 'dist';
if (args.target == 'build:dev') args.v = 'dev';

gulp.task('clean', function () {
	if (outDir != '.') {
		del([outDir]);
	}
});

gulp.task('contributors', ['clean'], function () {
	if (typeof config.contributors === 'undefined') return;

	var scoreFunction = function (line) {
		var score = 0;
		if (line) {
			score = line.replace(/\s/g, '').length;
			score = Math.log10(score + 100) - 2;
		}
		return score;
	};

	var decayFunction = function (date, score) {
		// date in milliseconds
		var t = new Date().getTime() - parseInt(date);
		//Half life of about a year
		var halfLife = 1000 * 60 * 60 * 24 * 365;
		return score * Math.pow(0.5, (t / halfLife));
	};
	// Append the output directory to be ignored. It gets deleted in the 'clean' task.
	var contribsSrc = config.contributors.src.concat(['!{' + outDir + ',' + outDir + '/**}']);
	return gulp.src(contribsSrc)
		.pipe(gitContributors({
			cwd: themeRoot,
			skipBoundary: true,
			scoreFunction: scoreFunction,
			decayFunction: decayFunction,
			skipCommits: config.contributors.skipCommits,
			hideEmails: true,
		}))
		.pipe(gulp.dest('tmp'));
});

gulp.task('i18n', ['clean'], function () {
	return gulp.src('**/*.php')
		.pipe(sort())
		.pipe(wpPot({
			domain: themeSlug,
			destFile: themeSlug + '.pot',
			package: themeSlug,
			bugReport: 'http://www.siteorigin.com',
			lastTranslator: 'SiteOrigin <support@siteorigin.com>',
			team: 'SiteOrigin <support@siteorigin.com>'
		}))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : 'languages'));
});

gulp.task('version', ['contributors'], function () {
	if (typeof args.v == "undefined") {
		console.log("version task requires version number argument.");
		console.log("E.g. gulp build:release -v 1.2.3");
		return;
	}
	return gulp.src(config.version.src)
		.pipe(replace(/(Stable tag:).*/, '$1 ' + args.v))
		.pipe(replace(/(Version:).*/, '$1 ' + args.v))
		.pipe(replace(/(define\('SITEORIGIN_THEME_VERSION', ').*('\);)/, '$1' + args.v + '$2'))
		.pipe(replace(/(define\('SITEORIGIN_THEME_JS_PREFIX', ').*('\);)/, '$1.min$2'))
		.pipe(gulp.dest('tmp'));
});

gulp.task('external-sass', ['clean'], function () {
	return gulp.src(config.sass.external.src, {base: '.'})
		.pipe(catchDevErrors(sass({
			includePaths: config.sass.external.include,
			outputStyle: args.target == 'build:release' ? 'compress' : 'nested'
		})))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('external-less', ['clean'], function () {
	return gulp.src(config.less.external.src, {base: '.'})
		.pipe(catchDevErrors(less({
			paths: config.less.external.include,
			compress: args.target == 'build:release'
		})))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('sass', ['external-sass', 'external-less'], function () {
	return gulp.src(config.sass.src)
		.pipe(replace(/(Version:).*/, '$1 ' + args.v))
		.pipe(catchDevErrors(sass({
			includePaths: config.sass.include,
			outputStyle: args.target == 'build:release' ? 'compress' : 'nested'
		})))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('concat', ['clean'], function () {

});

gulp.task('minify', ['concat'], function () {
	return gulp.src(config.js.src, {base: '.'})
		// This will output the non-minified version
		.pipe(gulp.dest('tmp'))
		.pipe(rename({suffix: '.min'}))
		.pipe(uglify())
		.pipe(gulp.dest('tmp'));
});

gulp.task('copy', ['version', 'sass', 'minify'], function () {
	//Just copy remaining files.
	return gulp.src(config.copy.src, {base: '.'})
		.pipe(gulp.dest('tmp'));
});

gulp.task('move', ['copy'], function () {
	return gulp.src('tmp/**')
		.pipe(gulp.dest(outDir + '/' + themeSlug));
});

gulp.task('build:release', ['move'], function () {
	del(['tmp']);
	var versionNumber = args.hasOwnProperty('v') ? args.v : 'dev';
	return gulp.src(outDir + '/**/*')
		.pipe(zip(themeSlug + '.' + versionNumber + '.zip'))
		.pipe(gulp.dest(outDir));
});

gulp.task('build:dev', ['sass'], function () {
	gutil.log('Watching SASS and LESS files...');
	gulp.watch([
		config.sass.src,
		config.sass.external.src,
		config.less.external.src
	], ['sass']);
});

gulp.task('default', ['build:release'], function () {

});
