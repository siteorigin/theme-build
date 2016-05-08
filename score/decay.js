/**
 * Decay a contribution based on its age.
 * 
 * @param date
 * @param score
 * @returns {number}
 */
module.exports = function( date, score ) {
	// date in milliseconds
	var t = new Date().getTime() - parseInt( date );

	//Half life of about a year
	var halfLife = 1000 * 60 * 60 * 24 * 365;
	return score * Math.pow( 0.5, (t / halfLife) );
};
