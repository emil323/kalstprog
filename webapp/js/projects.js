
var user_id = null;

load();

function load() {
	if (document.cookie.indexOf('connect.sid') == -1 ) {

	$("#project_invites").html('')
	$("#my_projects").html('')
	$("#shared_projects").html('')
	$("#display_name").html('')

	//Hent ut liste over prosjekter
	$.get('api/projects', function(res, status){


		$("#my_projects").append('<h1>Mine prosjekter</h1>');
		$("#shared_projects").append('<h1>Prosjekter delt med meg</h1>');
		//Sjekk og behandle feilmeldinger
		if(res.error) {
			if(res.error == "NOT_LOGGED_IN") {
				window.location.href = '/login.html'
			}
		} else {

			//Hent ut profildata, og putt i header

			var name = res.profile.first_name + ' ';
			if(res.profile.middle_name) {
				name += res.profile.middle_name + ' '
			}

			name += res.profile.last_name
			user_id = res.profile.id

			$("#display_name").append(name)
			$("#user_photo").attr("src",res.profile.photo_url)

			var has_own_projects = false;
			var has_shared_projects = false;

			//Sjekk om prosjekter er satt
			if(res.projects) {

				//Legg til prosjekter og sorter etter eier og delte prosjekter
				for (var i in res.projects) {

					project = res.projects[i];

					var content = '<div class="project"><p>	<h2>' + project.name + '</h2>' + permission_desc(project.permission) +
					'</p><a href="project.html?id='+ project.project_id +'">Åpne</a></div>';

					//N沠permission er 6, betyr det at prosjekt er eiet av bruker
					if(project.permission == Permissions.OWNER) {
						has_own_projects = true;
						$("#my_projects").append(content);
					} else {
						has_shared_projects = true;
						$("#shared_projects").append(content);
					}
				}

				//Opprett notis dersom ingen prosjekter er satt opp
				if(!has_own_projects) {
					$("#my_projects").append('<span class="notice">Du  har ikke opprettet noe prosjekter enda. </span>');
				}
				if(!has_shared_projects) {
					$("#shared_projects").append('	<span class="notice"> Ingen prosjekter er delt med deg enda. </span>');
				}
			}

			}
		});

		//Hent ut invitasjoner (dersom de finnes)
		$.get('api/projects/invites', function(invites, status){
			if(invites.error) {
				//hmm
			} else {
				//Har vi invitasjoner?
				if(invites.length > 0) {
					//Sett diven synlig
					$("#project_invites").append('<h1>Invitasjoner</h1>')
					$("#project_invites").css("display", "block");
					for (var i in invites) {
						var project = invites[i]
						var content = '<div class="project"><p>	<h2>' + project.name + '</h2>' + permission_desc(project.permission) +
						'</p><button id="' +project.project_id +'" class="btn" onclick="accept_invite(event)">Legg til</button></div>';
						$("#project_invites").append(content);
					}
				}

			}
		})


	} else {
		window.location.href = '/login.html'
	}
}

//Behandle oppretting av prosjekt
$("#create_project").click(function(event){

   project_name = $("#project_name").val();

   $.post( "/api/projects/create",
	  { project_name: project_name },
	  function(data) {
		 if(data.error) {

			 switch(data.error) {
				 case 'INVALID_PROJECT_NAME':
				 	alertify.alert("Ugyldig prosjekt navn.");
				 break
				 default:
				 	alertify.alert(data.error);
			 }
		 } else {
			 load()
		 }

	  }
   );

});

function accept_invite(event) {
	var project_id = event.currentTarget.id
	console.log(project_id)
	$.post( '/api/invites/accept',
	 { project_id: project_id },
	 function(data) {
		console.log(data)
		load()
	 }
	);
}
