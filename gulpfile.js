import gulp from 'gulp';
const { src, dest, series, parallel, watch } = gulp;
import gulpif from 'gulp-if';
import wpPot from 'gulp-wp-pot';
import sort from 'gulp-sort';
import { deleteAsync } from 'del';
import rename from 'gulp-rename';
import replace from 'gulp-replace';
import sass from 'gulp-sass';
import less from 'gulp-less';
import terser from 'gulp-terser';
import cssnano from 'gulp-cssnano';
import zip from 'gulp-zip';
import babel from 'gulp-babel';
import browserify from 'browserify';
import source from 'vinyl-source-stream';
import moment from 'moment';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';
import sourcemaps from 'gulp-sourcemaps';
import browserSync from 'browser-sync';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = require('../build-config.js');
const slug = config.slug;

// Change current working directory to theme root directory
process.chdir('..');

const args = yargs(hideBin(process.argv)).argv;
const outDir = args.outDir || (args._[0] === 'buildDev' ? '.' : 'dist');
const version = args.release || (args._[0] === 'buildDev' ? 'dev' : undefined);

const jsMinSuffix = config.jsMinSuffix;
const verSuffix = version ? `-${version.split('.').slice(0, 3).join('')}` : '';

const bs = browserSync.create();

// Helper function to catch errors in development
const catchDevErrors = (plugin) => {
	if (args.target === 'build:dev') {
		plugin.on('error', (error) => {
			console.error(error);
			plugin.emit('end');
		});
	}
	return plugin;
};

// Clean task
const clean = async () => {
	if (outDir === 'dist') {
		console.log(`Deleting output directory: ${outDir}`);
		await deleteAsync([outDir]);
	} else {
		console.log(`Not deleting output directory: ${outDir}`);
	}
};

// Version task
const versionTask = () => {
	if (typeof version === "undefined") {
		console.log("version task requires version number argument.");
		console.log("E.g. gulp release --release=1.2.3");
		return Promise.resolve();
	}
	return src(config.version.src)
		.pipe(replace(/(Stable tag:).*/, `$1 ${version}`))
		.pipe(replace(/(Build time:).*/, `$1 ${moment().format()}`))
		.pipe(replace(/(Version:).*/, `$1 ${version}`))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_VERSION',\s*').*('\s*\);)/, `$1${version}$2`))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_JS_PREFIX',\s*').*('\s*\);)/, `$1${jsMinSuffix}$2`))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_CSS_PREFIX',\s*').*('\s*\);)/, `$1${jsMinSuffix}$2`))
		.pipe(replace(/(define\(\s*'SITEORIGIN_THEME_VERSION_SUFFIX',\s*').*('\s*\);)/, `$1${verSuffix}$2`))
		.pipe(dest('tmp'));
};

// LESS task
const lessTask = () => {
	if (!config.less) {
		return Promise.resolve();
	}
	return src(config.less.src, { base: '.' })
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.init()))
		.pipe(catchDevErrors(less({ paths: config.less.include, compress: args.target === 'build:release' })))
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.write('.')))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'))
		.pipe(bs.stream());
};

// External LESS task
const externalLessTask = () => {
	if (!config.less.external) {
		return Promise.resolve();
	}
	return src(config.less.external.src, { base: '.' })
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.init()))
		.pipe(catchDevErrors(less({ paths: config.less.external.include, compress: args.target === 'build:release' })))
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.write('.')))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'))
		.pipe(bs.stream());
};

// SASS task
const sassTask = () => {
	if (!config.sass || !config.sass.src || config.sass.src.length === 0) {
		console.log('No SASS files to process');
		return Promise.resolve();
	}
	return src(config.sass.src, { base: '.' })
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.init()))
		.pipe(catchDevErrors(sass({ includePaths: config.sass.include, outputStyle: args.target === 'build:release' ? 'compressed' : 'expanded' })))
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.write('.')))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'))
		.pipe(bs.stream());
};

// External SASS task
const externalSassTask = () => {
	if (!config.sass.external) {
		return Promise.resolve();
	}
	return src(config.sass.external.src, { base: '.' })
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.init()))
		.pipe(catchDevErrors(sass({ includePaths: config.sass.external.include, outputStyle: args.target === 'build:release' ? 'compressed' : 'expanded' })))
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.write('.')))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'))
		.pipe(bs.stream());
};

// CSS task
const css = parallel(
	config.less && config.less.src && config.less.src.length > 0 ? lessTask : (cb) => cb(),
	config.less && config.less.external && config.less.external.src && config.less.external.src.length > 0 ? externalLessTask : (cb) => cb(),
	config.sass && config.sass.src && config.sass.src.length > 0 ? sassTask : (cb) => cb(),
	config.sass && config.sass.external && config.sass.external.src && config.sass.external.src.length > 0 ? externalSassTask : (cb) => cb()
);

// Babel task
const babelTask = () => {
	if (typeof config.babel === 'undefined') {
		return Promise.resolve();
	}
	return src(config.babel.src, { base: '.' })
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.init()))
		.pipe(babel({
			presets: ["@babel/preset-env", "@babel/preset-react"],
		}))
		.pipe(gulpif(args.target !== 'build:release', sourcemaps.write('.')))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'))
		.pipe(bs.stream());
};

// Browserify task
const browserifyTask = () => {
	if (typeof config.browserify === 'undefined') {
		return Promise.resolve();
	}

	const runBrowserify = (browserifyConfig) => {
		return browserify(browserifyConfig.src)
			.bundle()
			.on('error', (e) => console.error(e))
			.pipe(source(browserifyConfig.fileName))
			.pipe(dest('tmp'))
			.pipe(bs.stream());
	};

	if (Array.isArray(config.browserify)) {
		return Promise.all(config.browserify.map(runBrowserify));
	} else {
		return runBrowserify(config.browserify);
	}
};

// Minify CSS task
const minifyCss = () => {
	if (!config.css) {
		return Promise.resolve();
	}
	return src(config.css.src, { base: '.' })
		.pipe(gulpif(args.target === 'build:release', dest('tmp')))
		.pipe(rename({ suffix: '.min' }))
		.pipe(cssnano({ zindex: false, reduceIdents: false }))
		.pipe(dest(args.target === 'build:release' ? 'tmp' : '.'))
		.pipe(bs.stream());
};

// Minify JS task
const minifyJs = () => {
	console.log('Starting JS minification...');

	const jsFiles = [
		...(config.js && config.js.src ? config.js.src : []),
		'tmp/**/*.js'
	];

	return src(jsFiles, { base: '.' })
		.pipe(gulpif(file => !file.path.includes('.min.js'), rename({ suffix: jsMinSuffix })))
		.pipe(terser().on('error', (err) => {
			console.error('Terser error:', err.toString());
			this.emit('end');
		}))
		.pipe(dest('tmp'))
		.pipe(bs.stream())
		.on('end', () => console.log('JS minification completed.'));
};

// Copy task
const copy = () => {
	if (!config.copy) {
		return Promise.resolve();
	}
	return src(config.copy.src, { base: '.' })
		.pipe(dest('tmp'));
};

// i18n task
const i18n = () => {
	if (!config.i18n || !config.slug) {
		console.log('Missing i18n configuration or slug');
		return Promise.resolve();
	}
	const tmpDir = args.target === 'build:release' ? 'tmp/' : '';
	return src(config.i18n.src)
		.pipe(sort())
		.pipe(wpPot({
			domain: config.slug,
			package: config.slug,
			bugReport: 'http://www.siteorigin.com/thread',
			lastTranslator: 'SiteOrigin <support@siteorigin.com>',
			team: 'SiteOrigin <support@siteorigin.com>'
		}))
		.pipe(dest(`${tmpDir}lang/${config.slug}.pot`));
};

// Move task
const move = () => {
	const destDir = outDir === 'dist' ? `${outDir}/${config.slug}` : outDir;
	console.log(`Moving files to ${destDir}...`);
	return src('tmp/**/*', { base: 'tmp' })
		.pipe(dest(destDir));
};

// Build release task
const buildRelease = () => {
	const versionNumber = args.hasOwnProperty('release') ? version : 'dev';
	return src(`${outDir}/**/*`)
		.pipe(gulpif(outDir === 'dist', zip(`${config.slug}.${versionNumber}.zip`)))
		.pipe(dest(outDir));
};

// Build dev task
const buildDev = (cb) => {
	console.log('Building for development...');

	bs.init({
		server: {
			baseDir: "./"
		}
	});

	// Run initial builds
	const initialBuild = parallel(css, babelTask, browserifyTask);
	initialBuild(() => {
		console.log('Initial build complete. Setting up watchers...');

		// Set up watchers
		watch(config.less.src, lessTask);
		watch(config.less.external.src, externalLessTask);
		watch(config.sass.src, sassTask);
		watch(config.sass.external.src, externalSassTask);

		if (config.hasOwnProperty('babel')) {
			watch(config.babel.src, babelTask);
		}

		if (typeof config.browserify !== 'undefined') {
			const browserifyWatch = Array.isArray(config.browserify)
				? config.browserify.flatMap(b => b.watchFiles)
				: config.browserify.watchFiles;
			watch(browserifyWatch, browserifyTask);
		}

		watch(config.js.src, series(minifyJs, bs.reload));

		cb();
	});
};

// Update Google Fonts task
const updateGoogleFonts = async () => {
	if (!(config.googleFonts && config.googleFonts.dest)) {
		console.log('Missing googleFonts.dest config value. Need to know where to write the output file.');
		return;
	}
	if (!args.apiKey) {
		console.log('Missing apiKey argument. Google Fonts requires an API Key.');
		return;
	}

	const outFile = config.googleFonts.dest;
	const fontsUrl = `https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&key=${args.apiKey}`;

	try {
		const response = await fetch(fontsUrl);
		const body = await response.json();

		if (response.status !== 200) {
			console.log('An error occurred while fetching fonts:');
			console.log(`${body.error.code} ${body.error.message}`);
			body.error.errors.forEach(error => console.log(error));
			throw new Error('Google Fonts API error');
		}

		let fontsString = '<?php\n\nreturn array(\n';
		body.items.forEach(font => {
			fontsString += `\t'${font.family}' =>\n\t\tarray(\n`;
			font.variants.forEach((variant, i) => {
				fontsString += `\t\t\t${i} => '${variant}',\n`;
			});
			fontsString += '\t\t),\n';
		});
		fontsString += ');';

		await fs.promises.writeFile(outFile, fontsString);
		console.log('Successfully updated Google Fonts.');
	} catch (error) {
		console.log('An error occurred while fetching fonts:');
		console.log(error.message);
	}
};

const buildProcess = series(
	clean,
	versionTask,
	parallel(
		css,
		series(babelTask, browserifyTask)
	),
	parallel(minifyCss, minifyJs),
	copy,
	i18n,
	move,
	buildRelease
);

const errorHandler = (err) => {
	console.error('Build failed:', err);
	process.exit(1);
};

export const build = () => buildProcess().catch(errorHandler);

// Define js and minify tasks separately
const jsTasks = parallel(babelTask, browserifyTask);
const minifyTasks = parallel(minifyCss, minifyJs);

// Export tasks
export {
	clean,
	versionTask as version,
	css,
	jsTasks as js,
	minifyTasks as minify,
	copy,
	i18n,
	move,
	buildProcess as buildRelease,
	buildDev,
	updateGoogleFonts
};

// Default task
export default buildProcess;
