# theme-build
Generic gulp script to prepare SiteOrigin themes for the wordpress.org theme directory.

# Building SiteOrigin themes

There are few steps necessary to prepare a theme for release on the WordPress.org plugin directory. We use [Gulp](http://gulpjs.com/) to automate this.

## Environment setup

1. [Download](https://nodejs.org/download/) and install Node.js and npm.
2. In the theme folder, ensure the theme-build submodule has been checked out in a folder called 'build' and is up to date.
3. In a terminal, navigate to the build directory in the theme and run `npm install`
3. Get some coffee while npm installs the required packages.

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
