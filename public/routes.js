module.exports = function(app, passport) {

    var User = require('./models/user')

    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function(req, res) {
        res.render('index.ejs', { 
            user : req.user 
        }); // load the index.ejs file
    });

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/login', function(req, res) {
        // render the page and pass in any flash data if it exists
        res.render('login.ejs', { message: req.flash('loginMessage') }); 
    });

    // process the login form
    // app.post('/login', do all our passport stuff here);

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/signup', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
    // app.post('/signup', do all our passport stuff here);

    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/profile', isLoggedIn, function(req, res) {
        res.render('profile.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/update', isLoggedIn, function(req, res) {
        res.render('update.ejs', {
            user : req.user, 
            message: ''
        });
    });



    app.post('/update/:id', isLoggedIn, function(req, res) {
        var id = req.params.id;
        var new_name = req.body.new_name;


        if (!alphanumeric(new_name)) {
            res.render('update.ejs', {
                user: req.user,
                message: 'Username can only contain letters and numbers.'
            });
        }
        else if (new_name.length < 3 || new_name.length > 15) {
            if (new_name.length < 3) {
                msg = 'Username must be at least 3 characters.';
            }
            else {
                msg = 'Username cannot exceed 15 characters.';
            }

            res.render('update.ejs', {
                user: req.user,
                message: msg
            });
        }
        else {
            User.findByIdAndUpdate({ _id: id }, { username: new_name }, function(err, user) {
                if (err) {
                    res.render('update.ejs', {
                        user: req.user,
                        message: 'Username already taken'
                    });
                }
                else {
                    console.log("Updating username of " + id + " to " + new_name);
                    res.redirect('/');
                }
            });
        }
    });


    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect : '/', // redirect to the secure profile section
        failureRedirect : '/signup', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    app.post('/login', passport.authenticate('local-login', { 
        failureRedirect: '/login', 
        failureFlash: true }),

        function(req, res) {
            res.redirect('/');
            //var cur_user = { uid: req.user.uid, username: req.user.username, socket_id: -1 };
            //ONLINE_USERS.push(cur_user);
            //console.log("Currently online: " + ONLINE_USERS.username );
    });

    // =====================================
    // FACEBOOK ROUTES =====================
    // =====================================
    // route for facebook authentication and login
    app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

    // handle the callback after facebook has authenticated the user
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect : '/',
            failureRedirect : '/'
        }));

    // =====================================
    // GOOGLE ROUTES =======================
    // =====================================
    // send to google to do the authentication
    // profile gets us their basic information including their name
    // email gets their emails
    app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

    // the callback after google has authenticated the user
    app.get('/auth/google/callback',
            passport.authenticate('google', {
                    successRedirect : '/',
                    failureRedirect : '/'
            }));

};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}

function alphanumeric(txt) {  
    var letterNumber = /^[0-9a-zA-Z]+$/;  

    if(txt.match(letterNumber)) {  
        return true;  
    }  
    else {   
        return false;   
    }  
}  