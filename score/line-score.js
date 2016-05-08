module.exports = function( line, fileExtension ) {
	var score = 0;
	if ( line ) {
		// Judge longer lines as more valuable
		score = line.replace( /\s/g, '' ).length;
		score = Math.log10(score + 100) - 2;
	}
	return score;
};
