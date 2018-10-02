

/*
	Hent en beskrivelse av permission
*/

const Permissions = {
	READ_ONLY : 1,
	READ_WRITE : 2,
	ADD_FILES : 3,
	ADD_REMOVE_FOLDERS : 4,
	ADMIN : 5,
	OWNER : 6
};


function permission_desc(permission) {
	switch(permission) {
		case Permissions.READ_ONLY:
			return 'Lese';
		case Permissions.READ_WRITE:
			return 'Lese og skrive';
		case Permissions.ADD_FILES:
			return 'Opprett filer';
		case Permissions.ADD_REMOVE_FOLDERS:
			return 'Les og skriv';
		case Permissions.ADMIN:
			return 'Administrator';
		case Permissions.OWNER:
			return 'Eier';
	}
}

function get_url_vars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function urlify(text) {
    var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, function(url) {
        return '<a href="' + url + '" target="_blank">' + url + '</a>';
    });
}

/*
	Denne funksjonen gjør JSON objektet 'objects' om til et JSON objekt som JSTree biblioteket forstår
*/
function objects_to_jstree(objects, root_name) {

	data = []
	for (var i in objects) {
		var o = objects[i]
		console.log(o.parent_id)
		if(o.parent_id == null) {
			data.push({id: o.id, parent: '#', type: 'root',  text: root_name})
		} else {
			type = "folder";
			if(o.is_directory == false) {
				type = "file";
			}
			if(o.is_blob) {
				type = 'blob'
			}
			data.push({id: o.id, parent: o.parent_id, type: type, text: o.name})
		}

	}
	return data
}


function trigger_name_pointer(editor, col, row, name) {
		$("#name_pointer").css("display", "block");
		$("#name_pointer").text(name);
		var pos = editor.renderer.textToScreenCoordinates(row, col);
		$("#name_pointer").css("top", pos.pageY - 20);
		$("#name_pointer").css("left", pos.pageX);

		setTimeout(function(){
			$("#name_pointer").hide();

		},2000);
}

function get_user(users, id) {
	for (var i in users) {
		user = users[i]
		if(user.id == id) {
			return user;
		}
	}
}

function parse_name(user) {
		if(user) {
			return user.first_name + ' ' + user.last_name
		}
		return null
}

function parse_lines(lines) {
  var res = ""
  if(lines.length < 1) {
    res = lines[0] + "\n"
  } else {
    for (i = 0; i < lines.length; i++) {
      res += lines[i]
      if(i != lines.length -1) res += "\n"
    }
  }
  return res
}
