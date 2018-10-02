
var Pool = require('pg-pool')
var pg = require('pg')
/*
    Denne modulen sørger for behandling av database
*/

var config = require("./config.json");



//Sett type, dato Fiks
pg.types.setTypeParser( 1082, 'text', function( val ){
  return new Date( val + ' 00:00:00' );
});

//Definer database
const pool = new Pool({
  database: config.db.name,
  user: config.db.username,
  password: config.db.password,
  port: 5432,
  max: 20, // set pool max size to 20
  min: 4, // set min pool size to 4
  idleTimeoutMillis: 1000, // close idle clients after 1 second
  connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established
})

//Henter tilkoblings objekt
exports.query = function(query, options, callback) {
		pool.connect().then(client => {
			client.query(query, options).then(res => {
			client.release()
			callback(null,res)
		}).catch(e => {
			client.release()
			console.error('query error', e.message, e.stack)
			callback(e.message, null)
		})
	})
}
