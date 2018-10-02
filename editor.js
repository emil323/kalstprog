const db = require('./database.js');
const queries = require('./queries.js');
const ace = require('./lib/ace/document.js');
const wss = require('./wss.js')
const validator = require('./validator.js')

//objects inneholder en slags "mini" database hvor alle prosjekt og dens innlastede objekter befinner seg
var objects = {}

exports.attach = function(ws, req, data) {

  var valid = validator.editor_attach(data)

  if(valid) {
    //Sjekk om sesjon er tildelt et prosjekt og om bruker har lese tilgang
    if(ws.project_id && ws.permission >= 1) {
      //Sjekk om sesjon er 'attachet' til objekt allerede
      if(!ws.objects.includes(data.object_id)) {
        //Sjekk om object finnes i objects
        find_or_load_object(data.object_id, ws.project_id, function(err, object) {
          if(err) {
            switch(err) {
              case "NOT_FOUND":
                //Objektet som klient prøver å åpne finnes ikke
                force_detach(ws, data.object_id, 'NOT_FOUND')
              break
              case "DB_ERR":
                force_detach(ws, data.object_id, 'DB_ERR')
              break
            }
            //TODO: Send feilmelding til ws her
          } else {
            //Legg til objekt til sesjon
            ws.objects.push(data.object_id)
            //Send objekt til klient
            ws.send(JSON.stringify({
              scope: 'editor',
              cmd: 'attach',
              tick: object.tick,
              object_id: data.object_id,
              value: object.editor.getValue()
            }))
          }
        })
      } else {
      }
    } else {
      //Ingen tilgang til detter prosjektet
      force_detach(ws, data.object_id, 'NO_ACCESS')
    }
  } else {
    console.log(validator.editor_attach.errors)
    ws.terminate()
  }
}

exports.detach = function(ws, req, data) {

  var valid = validator.editor_detach(data)

  if(valid) {
    //Sjekk om objektID er 'attachet' til denne sesjonen
    if(ws.objects.includes(data.object_id)) {
        //Slett, og denne sesjonen vil ikke lenger mota inserts og removes
        var i = ws.objects.indexOf(data.object_id)
        if(i != -1) {
           ws.objects.splice(i, 1)
         }
        //Gidder ikke å gjøre noe mer med dette, ingen krise om det skulle skje noe feil her
    }
  } else {
    console.log(validator.editor_detach.errors)
    ws.terminate()
  }
}

exports.insert = function(ws, req, data) {
    //Sjekk om schema er riktig
    var valid = validator.editor_insert(data)

    if(valid) {
      //Sjekk om denne sesjonen er "attachet" til objektet
      if(ws.objects.includes(data.object_id)) {
        //Sjekk at bruker har skrive rettigheter
        if(ws.permission >= 2) {
          var object = objects[data.object_id]
          //Hent ut ACE editor
          var editor = object.editor
          //Utfør endringer
          console.log(data.tick)
          if(data.tick == object.tick) {
            editor.insert(data.start, parse_lines(data.lines));
            //Kringkast til alle som er "attachet" til dette objektet
            //legg til tick
            objects[data.object_id].tick++
            //Kringkast til alle som er "attachet" til dette objektet
            wss.broadcast_editor_change(
              ws.user_id, data.object_id, 'insert',
              {start: data.start, lines:data.lines})
          } else {
            //Klient er ikke i synk med server
            //Send feilmelding om at klient må "attache seg på ny"
            //TICK_ERR
            force_reattach(ws, data.object_id, 'TICK_ERR')
          }
        } else {
          //Ingen adgang
          force_detach(ws, data.object_id, 'NO_ACCESS')
        }
      } else {
        //Not attached
        force_reattach(ws, data.object_id, 'NOT_ATTACHED')
      }
    } else {
      console.log(validator.editor_insert.errors)
      ws.terminate()
    }
}



exports.remove = function(ws, req, data) {

  var valid = validator.editor_remove(data)

  if(valid) {
    //Sjekk om denne sesjonen er "attachet" til objektet
    if(ws.objects.includes(data.object_id)) {
      //Sjekk at bruker har skrive rettigheter
      if(ws.permission >= 2) {
        //Sjekk at tick fra klient er riktig
        var object = objects[data.object_id]
        if(data.tick == object.tick) {
          //Hent ut ACE editor
          var editor = object.editor
          //Definer området som skal slettes
          range = new ace.Range(data.start.row, data.start.column,
                                data.end.row,data.end.column)
          //Utfør endringer
          editor.remove(range);
          //legg til tick
          objects[data.object_id].tick++
          //Kringkast til alle som er "attachet" til dette objektet
          wss.broadcast_editor_change(
            ws.user_id,data.object_id, 'remove', {start: data.start, end: data.end})
        } else {
          //Klient er ikke i synk med server
          //Send feilmelding om at klient må "attache seg på ny"
          //TICK_ERR
          force_reattach(ws, data.object_id, 'TICK_ERR')
        }
      } else {
        //Ingen adgang
        force_detach(ws, data.object_id, 'NO_ACCESS')
      }
    } else {
      //Not attached
      force_reattach(ws, data.object_id, 'NOT_ATTACHED')
    }
  } else {
    //Ugyldig inndata
    console.log(validator.editor_remove.errors)
    ws.terminate()
  }
}
/*
  Fjerner et objekt fra en sesjon, gjøres som regel når vi vet at klient ikke henger med,
  har fått ny tilgang eller andre ting som gjør at klient må koble til på ny.
*/
function force_reattach(ws, object_id, msg) {
  //Fjern objekt dersom det finnes
  if(ws.objects.includes(object_id)) {
    var i = ws.objects.indexOf(object_id)
    if(i != -1) {
       ws.objects.splice(i, 1)
     }
  }
  ws.send(JSON.stringify({
    scope:"error",
    cmd:"reattach",
    object_id:object_id,
    error:msg
  }))
}

/*
  Gjør samme som reattach, men nå vil klient ikke prøve å koble til igjen.
  Mulig situasjon er om objekt er slettet eller tilgang er fjernet.
*/

function force_detach(ws, object_id, msg) {
  //Fjern objekt dersom det finnes
  if(ws.objects.includes(object_id)) {
    var i = ws.objects.indexOf(object_id)
    if(i != -1) {
       ws.objects.splice(i, 1)
     }
  }

  ws.send(JSON.stringify({
    scope:"error",
    cmd:"detach",
    object_id:object_id,
    error:msg
  }))
}


function find_or_load_object(object_id, project_id, callback) {
  if(objects[object_id]) {
    //Varm start: objekt allerede lastet
    callback(null, objects[object_id])
  } else {
    //Objekt som skal fylles
    var object = {}
    object.id = object_id
    //Tick - plusses med en hver gang det skjer en endring, db_tick for hver gang
    //objektet i databasen endrer seg
    object.tick = 0
    object.db_tick = 0
    //Kjør spørring for å hente objektet fra databasen, samt sist iterasjon
    db.query(queries.get_object_recent, [object_id], function(err, res) {
      if(err) {
        console.log(err)
        callback('DB_ERR', null)
      } else {
        if(res.rowCount > 0) {
          //Fant er resultat
          var o = res.rows[0]
          //Sjekk om prosjekt ID tilsvarer riktig prosjekt
          if(o.project_id === project_id) {
            object.project_id = project_id
            if(o.latest_iteration_id == null) {
              //Returner et tomt dokument som svar
              object.editor = new ace.Document("")
              objects[object_id] = object
              //Start overvåknings timer
              init_watchdog(object_id)
              //Returner resultat
              callback(null, object)
            } else {
              //Data finnes, hent ut iteratsjon
              db.query(queries.get_object_iteration, [o.latest_iteration_id, object_id], function(err, res) {
                if(err) {
                  callback('DB_ERR', null)
                } else {
                  if(res.rowCount > 0) {
                    //Sett ace editor med innhold fra siste iterasjon
                    object.editor = new ace.Document(res.rows[0].value)
                    objects[object_id] = object
                    //Start overvåknings timer
                    init_watchdog(object_id)
                    //Returner resultat
                    callback(null, object)
                  } else {
                    callback('DB_ERR', null)
                  }
                }
              })
            }
          } else {
            callback('NOT_FOUND', null)
          }
        } else {
          callback('NOT_FOUND', null)
        }
      }
    })
  }
}

//Denne funksjonen starter en timer, som vil sørge for at dokumenter blir lastet inn i databasen
function init_watchdog(object_id) {
	objects[object_id].watchdog = setInterval(function() {
    //Dersom tick og db_tick er foreskjellig, er versjon på database og versjon på webserver ulik.
    var object = objects[object_id]

    if(object.tick != object.db_tick) {
      //Hent inn innhold av editor
      var value = object.editor.getValue()
      //Kjør spørring for å sette inn data
      db.query(queries.insert_object_iteration, [object_id, value], function(err, res) {
        if(err) {
          console.log(err)
        } else {
          //Sett db_tick til tick for å signalisere at database er oppdatert med nyeste versjon
          object.db_tick = object.tick
        }
        //Ikke gjør noe mer her nå...
      })
    }
  }, 3000) //Kjør hvert 3 sekund
};

//Denne funksjonen gjør om lines array'et til en streng, hvor hver linje blir separert med \n
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
