

var gcs = require('@google-cloud/storage')({
  projectId: 'annular-catfish-146620',
  keyFilename: 'key.json'
});

var bucket = gcs.bucket('kalstprog');

exports.upload = function(hash, buffer, cb) {


  var file = bucket.file('uploads/' + hash)
  //Sjekk først om filnavn med hash finnes,
  //Da vet vi at fil allerede er lastet opp, vi slipper å gjenta
  //opplastningen
  file.exists(function(err, exists) {
    if(err) {
      //En feil skjedde, ikke gjør noe med det
      //TODO: Behandle feilmeldinger på en tilfredstillende måte
      cb(err)
    } else {

    if(!exists) {
      //Fil finnes ikke, lagre i bucket
      file.save(buffer, function(err) {
        if(err) {
          callback(err)
        } else {
          //Returner et velykket resultat
          cb(null)
        }
      })
    } else {
      //Returner et velykket resultat 
      cb(null)
    }
  }
})
}

exports.get = function(hash, cb) {
  var file = bucket.file('uploads/' + hash)

  file.get(function(err, file, apiResponse) {
    cb(err, file)
  })
}
