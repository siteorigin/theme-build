# Building SiteOrigin themes
There are few steps necessary to prepare a theme for release on the WordPress.org plugin directory. We use [Gulp](http://gulpjs.com/) to automate this.

## Environment setup
1. [Download](https://nodejs.org/download/) and install Node.js and npm.
2. Install gulp using `npm install -g gulp`.
3. In the theme folder, ensure the theme-build repository has been added as a submodule in a folder called 'build' and is up to date. This can be done using `git submodule add git@github.com:siteorigin/theme-build.git build`
4. In a terminal, navigate to the build directory in the theme and run `npm install`
5. Get some coffee while npm installs the required packages.

## Running builds
There are two build tasks, `build:release` and `build:dev`.

The release task performs the following subtasks:

1. Extracts the name of the theme from the parent directory into a variable called `themeSlug`.
2. Updates the version number in the `functions.php` and `readme.txt` files.
3. Compiles SASS files to CSS.
4. Minifies JavaScript files and adds a `.min` suffix.
5. Copies all files to a `dist/{themeSlug}` folder.
6. Creates a `.zip` archive with the appropriate filename ready for uploading to wordpress.org.

Release task usage:

`gulp build:release -v version`

Where `version` should be replaced with the required version number.
For example, say the next version of the theme is 1.2.3:

`gulp build:release -v 1.2.3`

The dev build task only has one subtask:

1) Watch SASS files for changes and compile to CSS.

This is simply to avoid having to manually recompile SASS files while working on them.

## Updating the Google fonts array
`gulp updateGoogleFonts ---apiKey {YOUR_API_KEY}` The task will require an update to the build-config file in each theme to specify the name and location of the fonts file.

Vantage requires a separate script to update the Google Fonts array. For instructions, see the following [Gist](https://gist.github.com/Misplon/ae1360916989e282830e3f45242055d4).