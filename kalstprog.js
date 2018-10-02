
var config = require("./config.json");

const db = require('./database.js')
const routes = require('./router.js')
const user = require('./user.js')
const events = require('./events.js')

const express = require('express')
const cel = require('connect-ensure-login')
const helmet = require('helmet')
const app = express()

const expressWs = require('express-ws')(app)
const multer  = require('multer')
const upload = multer({storage: multer.memoryStorage()}) //Ikke lagre fil på disk foreløpig

var e = require("events"),
    EventEmitter = e.EventEmitter;
    EventEmitter.defaultMaxListeners = 15
//gjør wss tilgjengelig for alle filene
wss = expressWs.getWss('/')

const passport = require('passport')
const FacebookStrategy = require('passport-facebook').Strategy
const body_parser = require('body-parser')


passport.use(new FacebookStrategy({
    clientID: config.facebook.clientID,
    clientSecret: config.facebook.clientSecret,
    callbackURL: "http://158.36.13.191:3000/auth/facebook/callback",
	profileFields: ['id', 'displayName','email', 'gender','name','photos']
  },
  function(accessToken, refreshToken, profile, cb) {

	user.findOrCreate(profile, function(err, id) {
    //Sett ID til oauth_id, og id til id...
    profile.oauth_id = profile.id
    profile.id = id

		return cb(null, profile)
	})
  }
))

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

app.use(helmet())
app.use(require('cookie-parser')());

app.use(body_parser.urlencoded({limit: '15mb', extended: true }));
app.use(require('express-session')({ secret: 'gsdf343q5sdfggsdafg4', resave: true, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('webapp'))

app.get('/auth/facebook',passport.authenticate('facebook', { scope: 'email', display: 'popup' }));
app.get('/auth/facebook/callback',passport.authenticate('facebook', { failureRedirect: '/login' }),routes.auth_callback);

app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/');
    });

app.get('/api/projects', routes.list_projects);
app.get('/api/project/:id', routes.get_project);
//psudo_filename gjør ingenting, er bare til hjelp for den som laster ned
app.get('/api/project/blob/:object_id/:psudo_filename', routes.get_file)

app.get('/api/projects/invites', routes.get_invites);
app.post('/api/invites/accept', routes.accept_invite)

app.post('/api/projects/create', routes.create_project)
app.post('/api/project/create_object',body_parser.json(), routes.create_object)
app.post('/api/project/delete_object', routes.delete_object)
app.post('/api/project/move_object', routes.move_object)
app.post('/api/project/rename_object', routes.rename_object)

app.post('/api/project/upload/', upload.single('file'), routes.upload_file)



/*
  Håndtering av websocket
*/

app.ws('/', function(ws, req) {
  //Tilkobling er sann
  ws.alive = true

  //Her er objektene som blir redigert av denne sesjonen
  ws.objects = []
  //Pong
  ws.on('pong', function() {
    ws.alive = true
  })
  //Sjekk om bruker er logget inn
  if(!req.user) {
    ws.send(JSON.stringify({
      scope:"error",
      cmd:"login"
    }))
    ws.terminate()
  }

  //Motta beskjeder fra websocket
  ws.on('message', function(data) {
      data = JSON.parse(data)
      switch(data.scope) {
        case 'event_handler':
          events.subscribe(ws, req, data)
        break;
        case "editor":
          events.editor(ws, req, data)
        break
        case 'chat':
          events.chat(ws, req, data)
        break;
      }

  })

  ws.on('close', function close() {
    events.cleanup(ws)
  })
})


//Motta forespørsler fra port 3000
app.listen(3000);
console.log("Kalstprog startet!");
