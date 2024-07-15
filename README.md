# Building SiteOrigin Themes

This repository contains the build process for SiteOrigin themes. We use [Gulp](http://gulpjs.com/) to automate the build process, making it easy to prepare themes for release on the WordPress.org theme directory.

## Environment Setup

1. [Download](https://nodejs.org/download/) and install Node.js and npm.
2. Install gulp globally using `npm install -g gulp`.
3. In the theme folder, ensure the theme-build repository has been added as a submodule in a folder called 'build' and is up to date. This can be done using:
   ```
   git submodule add git@github.com:siteorigin/theme-build.git build
   ```
4. In a terminal, navigate to the build directory in the theme and run `npm install`.
5. Grab a coffee while npm installs the required packages.

## Configuring Builds

Each theme has its own slug and different files needed for a build. Any theme that uses this build process is required to have a configuration file called `build-config.js` in the root of the theme directory. This file is in the form of an npm module which returns a configuration object used by the gulpfile to determine the files and folders needed for the build.

Here's an example of what a `build-config.js` file might look like:

```javascript
module.exports = {
    slug: 'vantage',
    jsMinSuffix: '.min',
    version: {
        src: [
            'functions.php',
            'readme.txt'
        ]
    },
    sass: {
        src: ['sass/**/*.scss'],
        include: ['sass'],
        external: {
            src: ['inc/settings/css/**/*.scss'],
            include: ['inc/settings/css'],
        }
    },
    less: {
        src: ['style.less', 'rtl.less', 'less/**/css/*.less', 'less/style-editor.less'],
        include: ['less/*.less'],
        external: {
            src: ['inc/panels-lite/css/**/*.less'],
            include: ['inc/panels-lite/css'],
        },
    },
    // ... other configuration options ...
};
```

## Running Builds

There are two main build tasks: `build:release` and `build:dev`.

### Release Build

The release task performs the following subtasks:

1. Updates the version number in the required files.
2. Compiles SASS and LESS files to CSS.
3. Processes JavaScript files with Babel and Browserify (if configured).
4. Minifies CSS and JavaScript files.
5. Copies all files to a `dist/{themeSlug}` folder.
6. Creates a `.zip` archive ready for uploading to wordpress.org.

To run a release build, use:

```
npm run build:release --release=X.X.X
```

Replace `X.X.X` with the desired version number. For example, if the next version of the theme is 1.2.3:

```
npm run build:release --release=1.2.3
```

### Development Build

The dev build task has the following functions:

1. Watches SASS and LESS files for changes and compiles them to CSS.
2. Processes JavaScript files with Babel and Browserify (if configured).
3. Uses Browser-Sync to provide live reloading of the browser.

This eliminates the need to manually recompile files while working on them.

To run a development build, use:

```
npm run build:dev
```

## Updating the Google Fonts Array

To update the Google Fonts array, use:

```
npm run updateGoogleFonts --apiKey=YOUR_API_KEY
```

Replace `YOUR_API_KEY` with your actual Google Fonts API key. This task requires an update to the `build-config.js` file in each theme to specify the name and location of the fonts file.

Remember to check the `build-config.js` file in your theme to ensure it's correctly configured for these tasks.

## Note for Vantage Theme

Vantage requires a separate script to update the Google Fonts array. For instructions, see the following [Gist](https://gist.github.com/Misplon/ae1360916989e282830e3f45242055d4).
