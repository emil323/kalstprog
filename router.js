
const db = require('./database.js');
const queries = require('./queries.js');
const wss = require('./wss.js')
const validator = require('./validator.js')
const istextorbinary =  require('istextorbinary')
const gcloud = require('./gcloud.js')
const md5 = require('md5')

/*
    Hent ut list over prosjekter
*/


exports.create_project = function(req, res, project_name) {

	if(req.user) {
		var valid = validator.create_project(req.body)

		if(valid) {
			var project_name = req.body.project_name

			db.query(queries.create_project, [project_name, req.user.id], function(err, db_res) {
				if(err) {
					console.log(err)
					res.json({error:'DB_ERR'})
				} else {
					res.json(db_res)
				}
			})
		} else {
			res.json({error:'INVALID_PROJECT_NAME'})
		}
	}
}


exports.create_object = function(req, res) {

	//Valider inndata

	console.log(req.body)

	var valid = validator.create_object(req.body)

	if(valid) {

		//Boolean er "false" eller "true", dvs en streng. Gjør konvertering på dette
		req.body.is_directory = (req.body.is_directory == 'true')

		if(req.user) {

			/*
				Den innebygde sql spørringen tar seg av autorisasjonsdelen, derfor trenger
				trenger bare å sørge for at inndataen er ren.
			*/

			db.query(queries.create_object,[req.user.id, req.body.parent_id, req.body.name, req.body.is_directory],
			function(err, db_res) {

				if(err) {
					console.log(err)
					switch(err) {
						case "NAME_TAKEN":
							res.json({error:err});
						case "NO_ACCESS":
							res.json({error:err});
						default:
							res.json({error:"DB_ERR"});
					}

				} else {
					//wss.broadcast_project_event(db)
					//Vi får en en tuple her, dette irriterer meg. Klur meg PLPGSQL her...
					//TODO: Fiks dette jævelskapet
					var data = db_res.rows[0].response.replace('(','').replace(')','').split(',')

					var object_id = data[0]
					var project_id = data[1]

					wss.broadcast_project_event(project_id, {
							action: 'new_object',
							user_id: req.user.id,
							object_id: object_id,
							is_directory: req.body.is_directory,
							parent_id: req.body.parent_id,
							name: req.body.name})
				 res.json({ object_id: object_id})
				}
			})

		}
	} else {
		console.log(validator.create_object.errors)
		res.json({error:"INVALID_INPUT"});
	}
}

exports.move_object = function(req, res) {
	console.log(req.body)

	if(req.user) {

		var valid = validator.move_object(req.body)

		if(valid) {
			//Kjør spørring
			db.query(queries.move_object, [req.user.id, req.body.object_id, req.body.new_parent_id], function(err, db_res) {
					if(err) {
						switch(err) {
							case "NO_ACCESS":
								res.json({error:err})
							break
							case "PARENT_INVALID":
								res.json({error:err})
							break
							case "NAME_DUPLICATE":
								res.json({error:err})
							break
							default:
								res.json({error:"DB_ERR"})
						}
					} else {

						var project_id = db_res.rows[0].project_id

						wss.broadcast_project_event(project_id, {
								action: 'move_object',
								user_id: req.user.id,
								object_id: req.body.object_id,
								new_parent_id:req.body.new_parent_id
							})
						res.json({res:"ok"});
					}
			})
		} else {
			console.log(validator.move_object.errors)
			res.json({error:'INVALID_INPUT'})
		}
	}
}

exports.rename_object = function(req, res) {
	if(req.user) {

		valid = validator.rename_object(req.body)

		if(valid) {


			db.query(queries.rename_object, [req.user.id, req.body.object_id, req.body.new_name], function(err, db_res) {
				if(err) {
					switch(err) {
						case "NAME_TAKEN":
							res.json({error:err})
						case "NO_ACCESS":
							res.json({error:err})
						default:
							res.json({error: "DB_ERR"})
					}
				} else {
					var data = db_res.rows[0].rename_object.replace('(','').replace(')','').split(',')

					var project_id = data[0]
					var new_name = data[1]

					wss.broadcast_project_event(project_id, {
							action: 'rename_object',
							user_id: req.user.id,
							object_id: req.body.object_id,
							new_name:new_name
						})
					res.json({res:"ok"});
				}
			})
		} else {
			console.log(validator.move_object.errors)
			res.json({error:'INVALID_INPUT'})
		}
	}
}

exports.delete_object = function(req, res) {
	if(req.user) {

		var object_id = req.body.object_id

		db.query(queries.delete_object, [req.user.id, object_id], function(err, db_res) {
				if(err) {
					switch(err) {
						case "HAS_CHILDREN":
							res.json({error:err})
						case "NO_ACCESS":
							res.json({error:err})
						default:
							res.json({error: "DB_ERR"})
					}
				} else {
					console.log(db_res.rows[0])
					wss.broadcast_project_event(db_res.rows[0].project_id, {
							action: 'delete_object',
							user_id: req.user.id,
							object_id: object_id
						})
					res.json({res:"ok"})
				}
		})
	}
}



exports.get_project = function(req, res) {
	var data = {}

	if(req.user) {

		data.profile = parse_profile(req.user)

		var project_id =req.params.id;
		var user_id = req.user.id

		//Bruker er logget in
		//TODO Få til et mer effektivt autorisasjonssytem her
		//Hent ut prosjektdata og hent ut prosjekt data, se spørring i queries.js
		db.query(queries.get_project_authorized, [project_id, user_id], function(err, db_res) {
			if(err) {
				//Ignorer denne feilmelding, kan være feil inndata
				res.json({error:'DB_ERR'});
			} else {
				if(db_res.rowCount > 0) {
					//Bruker er autorisert, legg til prosjektdata
					data.project = db_res.rows[0];

					//Hent ut alle dokumenter/objekter som har tilknyttning til prosjekter
					db.query(queries.get_project_objects, [project_id], function(err, db_res) {
						if(err) {
							//Dette er en "alvorlig feil", gå videre
							//TODO: Loggin
						} else {
							data.objects = db_res.rows;

							//Hent ut deltagere i et prosjekt
							db.query(queries.get_project_participants, [project_id], function(err, db_res) {
								if(err) {
									//Alvorlig feil som må logges
								} else {
									data.participants = db_res.rows

									db.query(queries.recent_messages, [project_id], function(err, db_res) {
										//Dene feilen er også alvorlig
										if(err) {
											console.log(err)
										} else {
											data.recent_messages = db_res.rows
											res.json(data)
										}
									})
								}
							});
						}
					});
				} else {
					res.json({error:'NOT_AUTHORIZED'})
				}
			}


		})
	} else {
		res.json({error: 'NOT_LOGGED_IN'})
	}
}



exports.list_projects = function(req, res) {

	var data = {};
	if(req.user) {
		//Bruker er logget inn
		data.profile = parse_profile(req.user)


		db.query(queries.list_projects, [req.user.id], function(err, db_res) {
			if(err) {
				//Meh... Ignorer feil og gå videre
				console.log(err)
			} else {
				data.projects = db_res.rows;
			}
			res.json(data)
		})
	} else {
		res.json({error: 'NOT_LOGGED_IN'})
	}


};

exports.get_invites = function(req, res) {
	var data = {}
	if(req.user) {
		//Bruker er logget inn
		db.query(queries.get_invites, [req.user.id], function(err, db_res) {
			if(err) {
				//Meh... Ignorer feil og gå videre
				console.log(err)
				res.json({error: 'DB_ERR'})
			} else {
				res.json(db_res.rows)
			}

		})
	} else {
		res.json({error: 'NOT_LOGGED_IN'})
	}
}

exports.accept_invite = function(req, res) {
	if(req.user) {
		var project_id = req.body.project_id
		console.log(req)
		//Bruker er logget inn
		db.query(queries.accept_invite, [req.user.id, project_id], function(err, db_res) {
			if(err) {
				//Meh... Ignorer feil og gå videre
				console.log(err)
				res.json({error: 'DB_ERR'})
			} else {
				res.json({res:'ok'})
			}

		})
	} else {
		res.json({error: 'NOT_LOGGED_IN'})
	}
}


exports.get_file = function(req, res) {
	if(req.user) {

		var object_id =req.params.object_id

		db.query(queries.get_file_ref, [req.user.id, object_id], function(err, db_res) {
			if(err) {
				switch(err) {
					case "NOT_FOUND":
						res.json({error:err})
					case "NO_ACCESS":
						res.json({error:err})
					default:
						res.json({error: "DB_ERR"})
				}
			} else {
				//Fil finnes og bruker har adgang, hent fil fra google cloud og send den til klient
				var file_ref = db_res.rows[0].file_ref

				gcloud.get(file_ref, function(err, file) {
					if(!err) {
						var stream = file.createReadStream();
							//Hatløsning: alle filer blir lastet ned istedenfor forsøkt vist i nettleser
							res.writeHead(200, {'Content-Type': 'application/octet-stream' });

							//Send til til klient
							stream.on('data', function (data) {
								res.write(data);
							})

							stream.on('error', function (err) {
								console.log(err);
								res.end()
							})

							stream.on('end', function () {
								res.end();
							})
					} else {
						res.send(err.code)
					}
				})
			}
		})

	} else {
		res.end()
	}
}

exports.upload_file = function(req, res) {
	//Bruker er logget inn
	if(req.user) {

		const parent_id = req.body.parent_id

		if(parent_id) {
			//Hent ut fil
			var file = req.file
			//Sjekk om fil består av tekst eller binær, dersom den er tekst, ikke last opp, men
			//Sett inn i database som et vanlig objekt med verdi som settes inn i ObjectIteration.
			istextorbinary.isText(file.originalname, file.buffer, function(err, is_text){
					if(is_text) {
						//Er tekst
						upload_text_file(req, res, parent_id, file)
					} else {
						//Last opp fil
						upload_blob_file(req, res, parent_id, file)
					}
			})
		}
	}
}

function upload_text_file(req, res, parent_id, file) {
	//Kjør spørring og sett inn tekst til database
	db.query(queries.create_object_with_value,
		[req.user.id,
		parent_id,
		file.originalname,
		file.buffer.toString()],
	function(err, db_res) {

		if(err) {
			//Feilmelding finnes
			console.log(err)
			switch(err) {
				case "NAME_TAKEN":
					res.json({error:err});
				case "NO_ACCESS":
					res.json({error:err});
				default:
					res.json({error:"DB_ERR"});
			}
		} else {

			//Hent ut objekt_id og prosjekt_id fra spørreresultat
			var data = db_res.rows[0].response.replace('(','').replace(')','').split(',')

			var object_id = data[0]
			var project_id = data[1]

			//Kjør kringasting av den nye opplastningen
			wss.broadcast_project_event(project_id, {
					action: 'new_object',
					user_id: req.user.id,
					object_id: object_id,
					is_directory: false,
					parent_id: parent_id,
					name: file.originalname})
			//Svar på spørring
			res.json({res: 'ok'})
		}

	})
}

function upload_blob_file(req, res, parent_id, file) {
	//Sett inn i database med is_blob true
	var hash = md5(file.buffer)
	//Sett inn i data
	db.query(queries.create_object_with_blob,
			[req.user.id,
			parent_id,
			file.originalname,
			hash],
	function(err, db_res) {
		if(err) {
			console.log(err)
			switch(err) {
				case "NAME_TAKEN":
					res.json({error:err});
				case "NO_ACCESS":
					res.json({error:err});
				default:
					res.json({error:"DB_ERR"});
				}
		} else {
			//Hent ut objekt_id og prosjekt_id fra spørreresultat
			var data = db_res.rows[0].response.replace('(','').replace(')','').split(',')

			var object_id = data[0]
			var project_id = data[1]
			//Fil er ikke tekst, last opp til Google cloud storage...
			gcloud.upload(hash, file.buffer, function(err) {
				if(err) {
					res.json({error:"UPLOAD_ERR"});
				} else {
					//Kjør kringasting av den nye opplastningen
					wss.broadcast_project_event(project_id, {
							action: 'new_object',
							user_id: req.user.id,
							object_id: object_id,
							is_directory: false,
							is_blob: true,
							parent_id: parent_id,
							name: file.originalname})
					//Svar på spørring
					res.json({res: 'ok'})
				}
			})
		}
	})
}


exports.auth_callback = function(req, res) {
	res.send('<script type="text/javascript"> if (window.opener) {window.opener.focus(); if(window.opener.loginCallBack) { window.opener.loginCallBack();}}window.close();</script> ');
};


function parse_profile(user) {
	return {
		id: user.id,
		first_name: user.name.givenName,
		middle_name: user.name.middleName,
		last_name: user.name.familyName,
		photo_url: user.photos[0].value
	}
}
