
const db = require('./database.js');
const queries = require('./queries.js');
const editor = require('./editor.js')
const wss = require('./wss.js')
const validator = require('./validator.js')

//Bruk DOMpurify for å beskytte mot XSS
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = (new JSDOM('')).window;
const DOMPurify = createDOMPurify(window);

//Autoriser websocket og gi beskjed om at bruker ønsker å motta hendelser
exports.subscribe = function(ws, req, data) {
  switch(data.cmd) {
    case 'subscribe':
      //Valider inndata fra klient, for å se at alt som skal være med er med
      //Vi gidder ikke å sjekke om det er ugyldig data her,
      var valid = validator.event_subscribe(data)

      if(valid) {
        //TODO sjekk om bruker er autorisert til prosjektet
        db.query(queries.get_project_authorized, [data.project_id, req.user.id], function(err, db_res) {
          if(err) {
            console.log(err)
            ws.terminate()
          } else {
            //Sett bruker id
            ws.user_id = req.user.id
            //Sett hvilket prosjekt denne sesjonen har
            ws.project_id = data.project_id
            //Objekt som er aktivt, som bruker har åpent i fanen
            ws.active_object = null
            //Boolean for om bruker er aktiv eller ikke, standard er ikke sann
            ws.active = data.active
            //Sett tilgangsnivå
            ws.permission = db_res.rows[0].permission;
            //Gi tilgang til chat, denne kan bi bruke senere til og eks. mute folk
            ws.can_chat = true
            //Send melding til alle om at en bruker har koblet seg til
            wss.broadcast_project_event(ws.project_id,{
                                        action:'new_connection',
                                        active: ws.active,
                                        user_id: ws.user_id
                                        })
            //Send tilbake melding på hvem som er tilkoblet dette prosjektet
            //Connected users er alle sesjonene som er koblet på dette prosjektet,
            //mens active_users er alle som er aktive på prosjektet. Dvs åpnet fane i netteleseren
            wss.get_active_users(ws.project_id, function(connected_users, active_users) {
              ws.send(JSON.stringify({
                                      scope:'event_handler',
                                      action:'all_connections',
                                      first_time:true,
                                      connected_users: connected_users,
                                      active_users: active_users}))
            })

            }
          })
        } else {
          //Skriv ut feilmelding
          console.log(validator.event_subscribe.errors)
          ws.terminate() //Terminer, har ikke bruk for en ugyldig klient i systemet
        }
      break
      case "update_connection_status":
        //Sjekk om inndata er korrekt
        var valid = validator.event_update_connection_status(data)
        if(valid) {
          //JA det er den
          ws.active = data.active
          //Send melding til alle prosjekt brukere med oppdatert bruker status
          wss.broadcast_project_event(ws.project_id,{
                                      action:'update_connection_status',
                                      active: ws.active,
                                      user_id: ws.user_id
                                      })
        } else {
          //Kjør kort prosess
          console.log(validator.event_subscribe.errors)
          ws.terminate()
        }
      break
  }
}

exports.editor = function(ws, req, data) {
  switch(data.cmd) {
    case "attach":
      editor.attach(ws, req, data)
    break
    case "detach":
      editor.detach(ws, req, data)
    break
    case "insert":
      editor.insert(ws, req, data)
    break
    case "remove":
      editor.remove(ws, req, data)
    break
  }
}

exports.chat = function(ws, req, data) {

  var valid = validator.chat(data)
  //Gyldig
  if(valid) {
  //Er autorisert til å chatte
  if(ws.can_chat) {
      //motvirk XSS angrep
      const clean_msg = DOMPurify.sanitize(data.msg, {USE_PROFILES: {html: false}})
      //Kjør spørring
      db.query(queries.new_chat_msg, [ws.project_id, req.user.id, clean_msg], function(err) {
        if(err) {
          //Hva gjør vi her?
          //gjør ingenting, noe må være galt.
          console.log(err)
        } else {
          wss.broadcast_project_chat(ws.project_id, {type: "msg", user_id: req.user.id, msg:clean_msg})
        }
      })
    }
  } else {
    //Kjør kort prosess her og
    console.log(validator.chat.errors)
    ws.terminate()
  }
}

//Funkjsonen som gjører når en tilkobling blir brutt
exports.cleanup = function(ws) {
    if(ws.project_id) {
      console.log('cleanup')
      //Send melding til alle i prosjektet med oppdaterte brukerliste
      wss.get_active_users(ws.project_id, function(connected_users, active_users) {
        wss.broadcast_project_event(ws.project_id,{
                                action:'all_connections',
                                connected_users: connected_users,
                                active_users: active_users})
      })
    }
}
