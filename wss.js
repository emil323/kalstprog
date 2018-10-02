const async = require('async')


exports.broadcast_project_event = function broadcast(project_id, msg) {

  msg.scope = "event_handler"
	wss.clients.forEach(function each(ws) {
		if(ws.project_id == project_id) {
			ws.send(JSON.stringify(msg));
		}
	})
}

exports.broadcast_project_chat = function broadcast(project_id, msg) {

  msg.scope = "chat"
	wss.clients.forEach(function each(ws) {
		//Check if client is needs to get document update
		if(ws.project_id == project_id) {
			ws.send(JSON.stringify(msg));
		}
	})
}

exports.broadcast_editor_change = function broadcast(user_id, object_id, cmd, data) {

  data.scope = "editor"
  data.object_id = object_id
  data.cmd = cmd
  data.user_id = user_id

	wss.clients.forEach(function each(ws) {
		//Finn klient er tilknyttet til objekt, og sjekk at sender ikke er mottaker
		if(ws.objects.includes(object_id)) {
      ws.send(JSON.stringify(data))
    }
	})
}

exports.get_active_users = function broadcast(project_id, callback) {

  var connected_users = []
  var active_users = []

  async.each(wss.clients, function(ws, next) {
    if(ws.project_id == project_id && !connected_users.includes(ws.user_id)) {
      connected_users.push(ws.user_id)
      if(ws.active) {
          active_users.push(ws.user_id)
      }
    }
    next()
  }, function(err) {
    if(err) {
      //hmmm, litt usikker hva jeg skal gjøre med denne
      console.log(err)
    }
    //Send tilbake resultat
    callback(connected_users, active_users)
  });
}



//Intervall som sjekker at tilkobling ikke er inaktiv/dø, som anbefalt
//https://github.com/websockets/ws
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.alive === false) return ws.terminate();

    ws.alive = false;
    ws.ping('', false, true);
  });
}, 30000)
