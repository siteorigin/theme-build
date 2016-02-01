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

var gitcontribs = require('./gitcontribs.js');

var args = {};
if(process.argv.length > 2) {
    var arr = process.argv.slice(2);
    args.target = arr[0];
    for (var i = 0; i < arr.length; i++) {
        var argName = arr[i];
        if(argName.match(/-\w+/i)) {
            args[argName.slice(1)] = arr[i + 1];
        }
    }
}

//Change current working directory to theme root directory.
process.chdir('..');
var themeRoot = process.cwd();
var pathParts = themeRoot.split(path.sep);
var themeSlug = pathParts[pathParts.length - 1];
var outDir = args.target == 'build:dev' ? '.' : 'dist';
if( args.target == 'build:dev') args.v = 'dev';

gulp.task('clean', function () {
    if( outDir != '.') {
        del([outDir]);
    }
});

gulp.task('contribs', ['clean'], function() {
  var files = [
    '**/*',
    '!{build,build/**}',                      // Ignore build/ submodule
    '!{inc/settings,inc/settings/**}',        // Ignore settings submodule
    '!{inc/panels-lite,inc/panels-lite/**}',  // Ignore panels-lite submodule
    '!{languages,languages/**}',              // Ignore languages
    '!{tests,tests/**}',                      // Ignore tests/ and contents if any
    '!{tmp,tmp/**}'                           // Ignore tmp/ and contents if any
  ];
  var skipCommits = [];
  return gulp.src(files)
    .pipe(gitcontribs({cwd:themeRoot, skipCommits: skipCommits, skipBoundary: true}))
    .pipe(gulp.dest('tmp'));
});

gulp.task('i18n', ['clean'], function() {
    return gulp.src('**/*.php')
        .pipe(sort())
        .pipe(wpPot( {
            domain: themeSlug,
            destFile: themeSlug + '.pot',
            package: themeSlug,
            bugReport: 'http://www.siteorigin.com',
            lastTranslator: 'SiteOrigin <support@siteorigin.com>',
            team: 'SiteOrigin <support@siteorigin.com>'
        } ))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : 'languages'));
});

gulp.task('version', ['contribs'], function() {
    if(typeof args.v == "undefined") {
        console.log("version task requires version number argument.");
        console.log("E.g. gulp release 1.2.3");
        return;
    }
    return gulp.src(['functions.php', 'readme.txt'])
        .pipe(replace(/(Stable tag:).*/, '$1 '+args.v))
        .pipe(replace(/(Version:).*/, '$1 '+args.v))
        .pipe(replace(/(define\('SITEORIGIN_THEME_VERSION', ').*('\);)/, '$1'+args.v+'$2'))
        .pipe(replace(/(define\('SITEORIGIN_THEME_JS_PREFIX', ').*('\);)/, '$1.min$2'))
        .pipe(gulp.dest('tmp'));
});

gulp.task('settings-sass', ['clean'], function(){
    return gulp.src(['inc/settings/css/**/*.scss'], {base: '.'})
        .pipe(sass({includePaths: ['inc/settings/css'], outputStyle: args.target == 'build:release' ? 'compress' : 'nested'}))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('panels-lite-less', ['clean'], function(){
    return gulp.src(['inc/panels-lite/css/**/*.less'], {base: '.'})
        .pipe(less({paths: ['inc/panels-lite/css'], compress: args.target == 'build:release'}))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('sass', ['settings-sass', 'panels-lite-less'], function() {
    return gulp.src(['sass/**/*.scss'])
        .pipe(replace(/(Version:).*/, '$1 '+args.v))
        .pipe(sass({includePaths: ['sass'], outputStyle: args.target == 'build:release' ? 'compress' : 'nested'}))
        .pipe(gulp.dest(args.target == 'build:release' ? 'tmp' : '.'));
});

gulp.task('concat', ['clean'], function () {

});

gulp.task('minify', ['concat'], function () {
    return gulp.src(
        [
            'js/**/*.js',
            'inc/settings/js/**/*.js',
            'inc/panels-lite/js/**/*.js',
            '!{node_modules,node_modules/**}',  // Ignore node_modules/ and contents
            '!{tests,tests/**}',                // Ignore tests/ and contents
            '!{tmp,tmp/**}'                     // Ignore tmp/ and contents
        ], {base: '.'})
        // This will output the non-minified version
        .pipe(gulp.dest('tmp'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(uglify())
        .pipe(gulp.dest('tmp'));
});

gulp.task('copy', ['version', 'sass', 'minify'], function () {
    //Just copy remaining files.
    return gulp.src(
        [
            '**/!(*.js|*.scss|*.md|style.css|woocommerce.css)',   // Everything except .js and .scss files
            '!{build,build/**}',                // Ignore build/ and contents
            '!{sass,sass/**}',                  // Ignore sass/ and contents
            'inc/settings/chosen/*.js',             // Ensure necessary .js files ignored in the first glob are copied
            '!{inc/settings/bin,inc/settings/bin/**}',  // Ignore settings/bin/ and contents
            '!{inc/settings/README.md}',            // Ignore settings/README.md
            '!{tests,tests/**}',                // Ignore tests/ and contents
            '!{tmp,tmp/**}',                    // Ignore tmp/ and contents
            '!phpunit.xml',                     // Not the unit tests configuration file. (If there is one.)
            '!functions.php',                   // Not the functions .php file. It is copied by the 'version' task.
            '!readme.txt',                      // Not the readme.txt file. It is copied by the 'version' task.
            '!npm-debug.log'                    // Ignore debug log from NPM if it's there
        ], {base: '.'})
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
    console.log('Watching SASS and LESS files...');
    gulp.watch([
        'inc/settings/css/**/*.scss',
        'inc/sass/**/*.scss'
    ], ['sass']);
});

gulp.task('default', ['build:release'], function () {

});
