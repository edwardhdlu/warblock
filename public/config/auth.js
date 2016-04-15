// expose our config directly to our application using module.exports
module.exports = {

    'facebookAuth' : {
        'clientID'      : '458803230974859', // your App ID
        'clientSecret'  : '9ae3682976d2dbf276575dd50c5438bc', // your App Secret
        'callbackURL'   : 'http://localhost:3000/auth/facebook/callback',
        'profileFields' : ['id', 'email', 'name']
    },

    'googleAuth' : {
        'clientID'      : '813421534394-2ua81ihamrtksnr2pqpldbav15a5l7nq.apps.googleusercontent.com',
        'clientSecret'  : 'iqyULWSZktx4Aihezgv9bSY5',
        'callbackURL'   : 'http://localhost:3000/auth/google/callback'
    }

};