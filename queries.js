



/*
    Liste over alle prosjekterHønefoss
*/


exports.list_projects =  `
	SELECT project_id,name, permission
	FROM ProjectPermission AS PP, Project AS P
	WHERE PP.project_id = P.id
	  AND PP.user_id = $1
 `;

/*
    Hent ut alle objekter i et prosjekt
*/

exports.list_objects = `
    SELECT *
    FROM Object
    WHERE project_id=?
		AND deleted IS FALSE
`;

 exports.create_project = `
	SELECT create_project($1, $2) AS project_id
 `

// in_oauth_id, in_first_name, in_last_name, in_email, in_photo_url

exports.find_or_create_user = `
	SELECT find_or_create_user( $1, $2,$3, $4, $5, 'facebook') AS id;
`

exports.get_project_authorized = `
	SELECT project_id, name, permission
	FROM ProjectPermission AS PP, Project AS P
	WHERE PP.project_id = P.id
	AND project_id = $1
	AND user_id = $2;
`

exports.get_project_objects = `
	SELECT *
	FROM Object
	WHERE project_id = $1
	AND deleted IS FALSE;
	;
`

exports.get_project_participants = `
	SELECT U.id, U.first_name, U.last_name, U.photo_url, permission
	FROM ProjectPermission PP, Users U
	WHERE PP.user_id = U.id
	  AND project_id = $1;
`

//create_object(in_user_id UUID, in_parent_id UUID, in_name text, is_directory BOOLEAN)
exports.create_object = `
	SELECT create_object($1, $2, $3, $4, false) AS response
`
//Fil opplastning, men innhold er tekst.
exports.create_object_with_value = `
	SELECT create_object($1, $2, $3, false, false, $4) AS response
`
//Dvs. Fil opplastning, med binært innhold $5 er hash som referanse til Google storage
exports.create_object_with_blob = `
	SELECT create_object($1, $2, $3, false, true, $4) AS response
`

// get_blob_ref(in_user_id UUID, in_object_id UUID)
exports.get_file_ref = `
	SELECT get_blob_ref($1, $2) AS file_ref
`

exports.move_object = `
	SELECT move_object($1, $2, $3) AS project_id
`

exports.rename_object = `
	SELECT rename_object($1, $2, $3)
`

exports.delete_object = `
	SELECT delete_object($1, $2) AS project_id
`
exports.new_chat_msg = `
	INSERT INTO ProjectMessage(project_id, user_id, value) VALUES($1,$2,$3)
`
exports.recent_messages = `
	SELECT user_id, value, time_created
	FROM ProjectMessage
	WHERE project_id = $1
	ORDER BY time_created DESC
	LIMIT 20;
`
//Hent ut id og prosjekt id samt tidspunktet til den siste iterasjonen
exports.get_object_recent = `
SELECT O.id, name, project_id, MAX(OI.id) AS latest_iteration_id
FROM Object AS O
LEFT JOIN ObjectIteration AS OI
  ON O.id =OI.object_id
WHERE O.id = $1
	AND deleted is FALSE
	AND is_directory IS FALSE
GROUP BY O.id, name, project_id
`
//Henter ut kun verdien til en iterasjon
exports.get_object_iteration = `
	SELECT value
	FROM ObjectIteration
	WHERE id = $1
	AND object_id = $2
`

exports.insert_object_iteration = `
	INSERT INTO ObjectIteration(object_id, value)
	VALUES ($1, $2);
`

exports.get_invites = `
	SELECT project_id, user_id, permission, name
	FROM ProjectInvitation AS PI, Project AS P
	WHERE PI.project_id = P.id
	AND user_id = $1
`
exports.accept_invite = `
	SELECT accept_invite($1,$2)
`
