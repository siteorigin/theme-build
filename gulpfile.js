var config = require( '../build-config.js' );
var gulp = require( 'gulp' );
var gulpif = require( 'gulp-if' );
var wpPot = require( 'gulp-wp-pot' );
var sort = require( 'gulp-sort' );
var del = require( 'del' );
var rename = require( 'gulp-rename' );
var replace = require( 'gulp-replace' );
var sass = require( 'gulp-sass' );
var sourcemaps = require( 'gulp-sourcemaps' );
var less = require( 'gulp-less' );
var uglify = require( 'gulp-uglify' );
var cssnano = require( 'gulp-cssnano' );
var zip = require( 'gulp-zip' );
var path = require( 'path' );
var gutil = require( 'gulp-util' );
var filter = require( 'gulp-filter' );
var livereload = require( 'gulp-livereload' );
var request = require( 'request' );
var fs = require( 'fs' );
var yargs = require( 'yargs' );

var args = yargs.argv;
if ( args.hasOwnProperty( '_' ) ) {
	args.target = args._[ 0 ];
}

var catchDevErrors = function ( plugin ) {
	if ( args.target === 'build:dev' ) {
		plugin.on( 'error', function ( error ) {
			gutil.log( error );
			plugin.emit( 'end' );
		} );
	}
	return plugin;
};

//Change current working directory to theme root directory.
process.chdir( '..' );
var themeRoot = process.cwd();
var pathParts = themeRoot.split( path.sep );
var themeSlug = pathParts[ pathParts.length - 1 ];
var outDir = args.target === 'build:dev' ? '.' : 'dist';
if ( args.target === 'build:dev' ) args.v = 'dev';

gulp.task( 'clean', function () {
	if ( outDir !== '.' ) {
		del( [ outDir ] );
	}
} );

gulp.task( 'i18n', [ 'clean' ], function () {
	var dir = args.target === 'build:release' ? 'tmp/' : '';
	return gulp.src( [ '**/*.php', '!tmp/**/*.php', '!dist/**/*.php' ] )
	.pipe( sort() )
	.pipe( wpPot( {
		domain: themeSlug,
		package: themeSlug,
		bugReport: 'http://www.siteorigin.com',
		lastTranslator: 'SiteOrigin <support@siteorigin.com>',
		team: 'SiteOrigin <support@siteorigin.com>'
	} ) )
	.pipe( gulp.dest( dir + 'languages/' + themeSlug + '.pot' ) );
} );

gulp.task( 'version', function () {
	if ( typeof args.v === "undefined" ) {
		gutil.log( "version task requires version number argument." );
		gutil.log( "E.g. gulp build:release -v 1.2.3" );
		return;
	}
	return gulp.src( config.version.src )
	.pipe( replace( /(Stable tag:).*/, '$1 ' + args.v ) )
	.pipe( replace( /(Version:).*/, '$1 ' + args.v ) )
	.pipe( replace( /(define\(\s*'SITEORIGIN_THEME_VERSION', ').*('\s*\);)/, '$1' + args.v + '$2' ) )
	.pipe( replace( /(define\(\s*'SITEORIGIN_THEME_JS_PREFIX', ').*('\s*\);)/, '$1.min$2' ) )
	.pipe( replace( /(define\(\s*'SITEORIGIN_THEME_CSS_PREFIX', ').*('\s*\);)/, '$1.min$2' ) )
	.pipe( gulp.dest( 'tmp' ) );
} );

gulp.task( 'sass', function () {
	return gulp.src( config.sass.src )
	.pipe( replace( /(Version:).*/, '$1 ' + args.v ) )
	.pipe( gulpif( args.target !== 'build:release', sourcemaps.init() ) )
	.pipe( catchDevErrors( sass( {
		includePaths: config.sass.include,
	} ) ) )
	.pipe( gulpif( args.target !== 'build:release', sourcemaps.write( './sass/maps' ) ) )
	.pipe( gulp.dest( '.' ) )
	.pipe( livereload() );
} );

gulp.task( 'external-sass', function () {
	return gulp.src( config.sass.external.src, { base: '.' } )
	.pipe( catchDevErrors( sass( {
		includePaths: config.sass.external.include,
	} ) ) )
	.pipe( gulp.dest( '.' ) )
	.pipe( livereload() );
} );

gulp.task( 'less', function () {
	return gulp.src( config.less.src )
	.pipe( replace( /(Version:).*/, '$1 ' + args.v ) )
	.pipe( catchDevErrors( less( {
		paths: config.less.include,
		compress: false
	} ) ) )
	.pipe( gulp.dest( '.' ) )
	.pipe( livereload() );
} );

gulp.task( 'external-less', function () {
	return gulp.src( config.less.external.src, { base: '.' } )
	.pipe( catchDevErrors( less( {
		paths: config.less.external.include,
		compress: false
	} ) ) )
	.pipe( gulp.dest( '.' ) )
	.pipe( livereload() );
} );

gulp.task( 'minifyCss', [ 'less', 'external-less', 'sass', 'external-sass' ], function () {
	var cssSrc = config.css.src;
	return gulp.src( cssSrc, { base: '.' } )
	// This will output the non-minified version
	.pipe( gulpif( args.target === 'build:release', gulp.dest( 'tmp' ) ) )
	.pipe( rename( { suffix: '.min' } ) )
	.pipe( cssnano( { zindex: false, reduceIdents: false } ) )
	.pipe( gulp.dest( args.target === 'build:release' ? 'tmp' : '.' ) );
} );

gulp.task( 'minifyJs', function () {
	return gulp.src( config.js.src, { base: '.' } )
	// This will output the non-minified version
	.pipe( gulp.dest( 'tmp' ) )
	.pipe( rename( { suffix: '.min' } ) )
	.pipe( uglify() )
	.pipe( gulp.dest( 'tmp' ) );
} );

gulp.task( 'copy', [ 'version', 'minifyJs', 'minifyCss', 'i18n' ], function () {
	
	var phpFilter = filter( [ '**/*.php' ], { restore: true } );
	
	// Copy the remaining files and replace certain strings in PHP
	return gulp.src( config.copy.src, { base: '.' } )
	.pipe( phpFilter )
	.pipe( replace( "'siteorigin-installer'", "'" + config.slug + "'" ) )
	.pipe( replace( "'siteorigin'", "'" + config.slug + "'" ) )
	.pipe( phpFilter.restore )
	.pipe( gulp.dest( 'tmp' ) );
} );

gulp.task( 'move', [ 'copy', 'clean' ], function () {
	return gulp.src( 'tmp/**' )
	.pipe( gulp.dest( outDir + '/' + themeSlug ) );
} );

gulp.task( 'build:release', [ 'move' ], function () {
	del( [ 'tmp' ] );
	var versionNumber = args.hasOwnProperty( 'v' ) ? args.v : 'dev';
	return gulp.src( outDir + '/**/*' )
	.pipe( zip( themeSlug + '.' + versionNumber + '.zip' ) )
	.pipe( gulp.dest( outDir ) );
} );

gulp.task( 'build:dev', [ 'sass', 'external-sass', 'less', 'external-less' ], function () {
	
	gutil.log( 'Starting livereload.' );
	livereload.listen();
	
	gutil.log( 'Watching SASS files...' );
	gulp.watch(
		[ config.sass.src ],
		[ 'sass' ]
	);
	gulp.watch(
		[ config.sass.external.src ],
		[ 'external-sass' ]
	);
	
	gutil.log( 'Watching LESS files...' );
	gulp.watch(
		[ config.less.src ],
		[ 'less' ]
	);
	gulp.watch(
		[ config.less.external.src ],
		[ 'external-less' ]
	);
	
	gutil.log( 'Watching JS files...' );
	gulp.watch( [ config.js.src ], livereload.reload );
} );

gulp.task( 'default', [ 'build:release' ], function () {

} );

gulp.task( 'updateGoogleFonts', function () {
	if ( ! ( config.googleFonts && config.googleFonts.dest ) ) {
		gutil.log( 'Missing googleFonts.dest config value. Need to know where to write the output file.' );
		return;
	}
	
	if ( ! args.apiKey ) {
		gutil.log( 'Missing apiKey argument. Google Fonts requires an API Key.' );
		return;
	}
	
	var outFile = config.googleFonts.dest;
	
	var fontsUrl = 'https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=' + args.apiKey;
	
	request( {
		url: fontsUrl,
		json: true,
	}, function ( error, response, body ) {
		
		if ( error ) {
			gutil.log( 'An error occurred while fetching fonts:' );
			gutil.log( error.message );
			return;
		}
		
		if ( body.error ) {
			gutil.log( 'An error occurred while fetching fonts:' );
			gutil.log( body.error.code.toString() + ' ' + body.error.message );
			body.error.errors.forEach( function ( error ) {
				gutil.log( error );
			} );
			return;
		}
		
		var fontsString = '<?php\n\nreturn array (\n';
		var fonts = body.items;
		fonts.forEach( function( font ) {
			fontsString += "\t'" + font.family + "' => array (\n";
			fontsString += "\t\t'category' => '" + font.category + "',\n";
			
			fontsString += "\t\t'variants' => array(\n";
			font.variants.forEach( function ( variant, i ) {
				fontsString += "\t\t\t" + i + " => '" + variant + "',\n"
			} );
			fontsString += "\t\t),\n";
			
			fontsString += "\t\t'subsets' => array(\n";
			font.subsets.forEach( function ( subsets, i ) {
				fontsString += "\t\t\t" + i + " => '" + subsets + "',\n"
			} );
			fontsString += "\t\t),\n";
			fontsString += "\t),\n";
		} );
		fontsString += ");";
		
		fs.writeFile( outFile, fontsString, function ( error ) {
			if ( error ) {
				gutil.log( error.message );
				throw error;
			}
			gutil.log( 'Successfully updated Google Fonts.' );
		} );
	} );
	
} );
