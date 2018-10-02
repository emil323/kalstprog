const db = require('./database.js');
const queries = require('./queries.js');


exports.findOrCreate = function(profile, callback) {

	first_name = profile.name.givenName;
	last_name = profile.name.familyName;
	email = profile.emails[0].value;
	photo_url = profile.photos[0].value;

	//Sjekk om bruker har mellomnavn, og putt det inn i sammen med etternavn
	if(profile.name.middleName) {
		last_name = profile.name.middleName + ' ' + last_name
	}
    db.query(queries.find_or_create_user,[profile.id, first_name, last_name, email, photo_url], function(err, data) {
			if(err) {
				console.log(err)
				callback(err, null)
			} else {
				callback(null, data.rows[0].id)
			}
	})
};
