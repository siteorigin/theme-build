/**
 * Calculate the value of a line of code.
 *
 * @param line The string content of the line
 * @param lineNumber The line number of this string
 * @param fileLines All the lines of code in the given file
 * @param fileExtension The extension of the given file
 * @returns {number}
 */
module.exports = {

	file: null,
	fileContents: null,
	fileExtension: null,
	fileLines: null,

	loadFile: function( file ) {
		this.file = file;
		this.fileExtension = file.path.split('.').pop();
		this.fileContents = file.contents.toString();
		this.fileLines = file.contents.toString().split("\n");

		// We can perform any other analysis we need here
	},

	scoreLine: function( line, lineNumber, fileLines, fileExtension ) {
		var score = 0;
		if ( line ) {
			// Judge longer lines as more valuable
			score = line.replace( /\s/g, '' ).length;
			score = Math.log10(score + 100) - 2;
		}
		return score;
	}


}
