/**
 * Calculate the value of a line of code.
 *
 * @param line The string content of the line
 * @param lineNumber The line number of this string
 * @param fileLines All the lines of code in the given file
 * @param fileExtension The extension of the given file
 * @returns {number}
 */
module.exports = function( line, lineNumber, fileLines, fileExtension ) {
	var score = 0;
	if ( line ) {
		// Judge longer lines as more valuable
		score = line.replace( /\s/g, '' ).length;
		score = Math.log10(score + 100) - 2;
	}
	return score;
};
