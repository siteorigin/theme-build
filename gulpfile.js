var config = require('../build-config.js');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var wpPot = require('gulp-wp-pot');
var sort = require('gulp-sort');
var del = require('del');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var less = require('gulp-less');
var uglify = require('gulp-uglify');
var cssnano = require('gulp-cssnano');
var zip = require('gulp-zip');
var path = require('path');
var gutil = require('gulp-util');
var filter = require('gulp-filter');
var livereload = require('gulp-livereload');

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
			plugin.emit('end');
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

	// Append the output directory to be ignored. It gets deleted in the 'clean' task.
	var contribsSrc = config.contributors.src.concat(['!{' + outDir + ',' + outDir + '/**}']);
	return gulp.src(contribsSrc)
		.pipe(gitContributors({
			cwd: themeRoot,
			skipBoundary: true,
			skipCommits: config.contributors.skipCommits,
			excludeEmails: config.contributors.excludeEmails || [],
			hideEmails: true,
			outputPath: 'inc/',
			format: 'php'
		}))
		.pipe(gulp.dest('tmp'));
});

gulp.task('i18n', [ 'clean' ], function () {
	return gulp.src(['**/*.php', '!dist/**/*.php'])
		.pipe(sort())
		.pipe(wpPot({
			domain: themeSlug,
			destFile: themeSlug + '.pot',
			package: themeSlug,
			bugReport: 'http://www.siteorigin.com',
			lastTranslator: 'SiteOrigin <support@siteorigin.com>',
			team: 'SiteOrigin <support@siteorigin.com>'
		}))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp/languages' : 'languages'));
});

gulp.task('version', ['contributors'], function () {
	if (typeof args.v == "undefined") {
		console.log("version task requires version number argument.");
		console.log("E.g. gulp build:release -v 1.2.3");
		return;
	}
	return gulp.src(config.version.src)
		.pipe(replace(/(Stable tag:\s*).*/, '$1 ' + args.v))
		.pipe(replace(/(Version:\s*).*/, '$1 ' + args.v))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_VERSION', ').*('\s*\);)/, '$1' + args.v + '$2'))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_JS_PREFIX', ').*('\s*\);)/, '$1.min$2'))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_CSS_PREFIX', ').*('\s*\);)/, '$1.min$2'))
		.pipe(gulp.dest('tmp'));
});

gulp.task('sass', function ( ) {
	return gulp.src(config.sass.src)
		.pipe(replace(/(Version:\s*).*/, '$1 ' + args.v))
		.pipe(gulpif(args.target != 'build:release', sourcemaps.init()))
		.pipe(catchDevErrors(sass({
			includePaths: config.sass.include,
		})))
		.pipe(gulpif(args.target != 'build:release', sourcemaps.write('./sass/maps')))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'))
		.pipe(livereload());
});

gulp.task('external-sass', function () {
	return gulp.src(config.sass.external.src, {base: '.'})
		.pipe(catchDevErrors(sass({
			includePaths: config.sass.external.include,
		})))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'))
		.pipe(livereload());
});

gulp.task('less', function () {
	return gulp.src(config.less.src)
		.pipe(replace(/(Version:).*/, '$1 ' + args.v))
		.pipe(catchDevErrors(less({
			paths: config.less.include,
			compress: false
		})))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'))
		.pipe(livereload());
});

gulp.task('external-less', function () {
	return gulp.src(config.less.external.src, {base: '.'})
		.pipe(catchDevErrors(less({
			paths: config.less.external.include,
			compress: false
		})))
		.pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'))
		.pipe(livereload());
});

gulp.task('minify', ['less', 'external-less', 'sass', 'external-sass'], function () {
	var minSrc = config.js.src.concat(config.css.src);
	return gulp.src(minSrc, {base: '.'})
		// This will output the non-minified version
		.pipe(gulp.dest('tmp'))
		.pipe(rename({suffix: '.min'}))
		.pipe(gulpif('*.js', uglify()))
		.pipe(gulpif('*.css', cssnano()))
		.pipe(gulp.dest('tmp'));
});

gulp.task('copy', ['version', 'minify', 'i18n'], function () {

	var phpFilter = filter( ['**/*.php'], {restore: true} );

	// Copy the remaining files and replace certain strings in PHP
	return gulp.src(config.copy.src, {base: '.'})
		.pipe( phpFilter )
		.pipe( replace( "'siteorigin'", "'" + config.slug + "'") )
		.pipe( phpFilter.restore )
		.pipe( gulp.dest('tmp') );
});

gulp.task('move', ['copy', 'clean'], function () {
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

gulp.task('build:dev', ['sass', 'external-sass', 'less', 'external-less'], function () {
	
	gutil.log('Starting livereload.');
	livereload.listen();
	
	gutil.log('Watching SASS files...');
	gulp.watch(
		[ config.sass.src ],
		['sass']
	);
	gulp.watch(
		[ config.sass.external.src ],
		['external-sass']
	);

	gutil.log('Watching LESS files...');
	gulp.watch(
		[ config.less.src ],
		[ 'less' ]
	);
	gulp.watch(
		[ config.less.external.src ],
		[ 'external-less' ]
	);
});

gulp.task('default', ['build:release'], function () {

});
