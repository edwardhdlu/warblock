//REQUIRES
var express = require("express");
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var clone = require('clone');
var clients = {};

ONLINE_USERS = [];
GAME_PAIR = { p1: 0, p2: 0 }

// REQS FOR USER AUTH
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

//MONGOOSE (HONK)
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/games');

//DATABASE SCHEMA
var gameSchema = mongoose.Schema({
    user1: Object,
    user2: Object,
    map: Object,
    user1id: String,
    user2id: String
})

var gameModel = mongoose.model("opengames", gameSchema);

//FUNCTION FOR PRINTING SEPERATED MESSAGES
function debug(msg){
    console.log(msg);
    console.log("****************");
}

//FUNCTION THAT APPLIES MOVE TO MAP STATE
function applyMove(state, move, user){
    var board = state.map.board.split(".").map(function(x){return x.split("");});
    var tank1 = state.map.tank1,
        tank2 = state.map.tank2;
    
    var xChange = 0,
        yChange = 0;
    
    var movingTank = (user==1)?tank1:tank2;
    debug("CURRENTLY MOVING TANK:");
    debug(movingTank);
    debug("THIS IS TANK 1:");
    debug(tank1);
    var newDir = movingTank.dir;
    if(movingTank.dir != move){
        newDir = move;
    }else{
        if(move == "up"){
            yChange = -1;
        }else if(move == "down"){
            yChange = 1;
        }else if(move == "left"){
            xChange = -1;
        }else if(move == "right"){
            xChange = 1;
        }
    }

    var target = board[movingTank.y + yChange][movingTank.x + xChange];
    if(target=="A"){
        //Successful move
        debug("Successful move, changing position!");
        if(user==1){
            state.map.tank1.x += xChange;
            state.map.tank1.y += yChange;
        }else{
            state.map.tank2.x += xChange;
            state.map.tank2.y += yChange;
        }
    }
    if(user==1){
        state.map.tank1.dir = newDir;
    }else{
        state.map.tank2.dir = newDir;
    }
    
    return state;
}

//SERVE FILES TO CLIENT
app.use(express.static("public"));
app.use("/stylesheets", express.static("public/stylesheets"));
app.use("/scripts", express.static("public/javascript"));
app.use("/assets", express.static("public/assets"));

//CALLED ON SUCCESSFULL CONNECTION
io.on('connection', function(socket){
    debug("New connection! User id:" + socket.id);

    var User = require('./public/models/user');

    socket.on('newuser', function(uid) {

        User.find({ _id: uid }, 
            function(err,docs) {
                if (docs) {
                    var user = docs[0];
                    debug(user.username + " has joined");

                    // check if prior game already exists with the current user
                    console.log("Searching for " + user.id);
                    gameModel.findOne({$or:[{user1id: user.id}, {user2id: user.id}]}, 
                    function(err,docs){

                        if(docs) {
                            socket.emit('game render', docs.map);
                            console.log("Resuming game with map: ", docs.map);
                            return;
                        }
                    });


                    var userObj = { user: user, socket: socket };
                    ONLINE_USERS.push(userObj);
                    debug("Signed in users: " + ONLINE_USERS.length);

                    if (ONLINE_USERS.length >= 2) {
                        var user1 = ONLINE_USERS[0].user;
                        var sock1 = ONLINE_USERS[0].socket;

                        var user2 = ONLINE_USERS[1].user;
                        var sock2 = ONLINE_USERS[1].socket;

                        GAME_PAIR.p1 = ONLINE_USERS[0];
                        GAME_PAIR.p2 = ONLINE_USERS[1];

                        ONLINE_USERS.pop();
                        ONLINE_USERS.pop();

                        if (user1.id == user2.id) {
                            return;
                        }

                        debug("Attempting to create gamestate for users: " + user1.username + " vs. " + user2.username);

                        var map = {
                            board: "XXXXXXXXXXXXXXXXXXXXXXXXXX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XAAAAAAAAAAAAAAAAAAAAAAAAX.XXXXXXXXXXXXXXXXXXXXXXXXXX",          
                            tank1: {                                   
                                x: 1,                                 
                                y: 2,                                  
                                dir: "down"
                            },
                            tank2: {
                                x: 5,
                                y: 3,
                                dir: "left"
                            },
                            yourTurn: 1
                        }

                        var newGame = new gameModel({user1: sock1.id, user2: sock2.id, map: map, user1id: user1.id, user2id: user2.id });
                        console.log("Created new game with userids: " + newGame.user1id + " " + newGame.user2id);
                        newGame.save(function(err, result){
                            if(err){
                                console.error(err);
                            }else{
                                debug("Game created: " + result);
                                sock1.emit('game init', map);

                                // SWAP GAME PERSPECTIVE
                                var temp = map.tank1;
                                map.tank1 = map.tank2;
                                map.tank2 = temp;
                                map.yourTurn = 0;

                                sock2.emit('game init', map)

                            }
                        })

                    }
                }
        });    
    });
    
    socket.on('disconnect', function(){
        debug("User disconnected: " + socket.id);
        
        gameModel.find( {$or:[{user1: socket.id}, {user2: socket.id}]}, 
            function(err,docs){
                if(!err){
                    if(docs==undefined || docs.length==0 || docs == null)
                        return;
                    var otherUser = (docs[0].user1 == socket.id)?docs[0].user2:docs[0].user1;
                    gameModel.remove({$or:[{user1: socket.id}, {user2: socket.id}]}, function(err, removed){
                        console.log("Deleted active game.")
                    })
                    console.log("Other user was: " + otherUser);

                    if (otherUser == GAME_PAIR.p1.socket.id) {
                        GAME_PAIR.p1.socket.emit('opponent disconnected', 0);
                    }
                    else {
                        GAME_PAIR.p2.socket.emit('opponent disconnected', 0)
                    }
                } 
            }
        );
        
        
    });
    
    socket.on('command', function(msg){
        console.log('command: ' + msg);
        gameModel.findOne({$or:[{user1: socket.id}, {user2: socket.id}]}, 
            function(err,docs){
                if(docs==undefined || docs.length==0 || docs==null)
                    return; //Bad request, no game exists with this user
                
                //Check if it's currently the users turn.
                var obj = clone(docs);
                var curID = socket.id;

                if((obj.map.yourTurn == 1 && obj.user1 != curID) || (obj.map.yourTurn == 2 && obj.user2 != curID)){
                    //Wrong user issued a command
                    console.log("WRONG USER");
                    socket.emit('consoleerror', "It's not your turn right now!");
                    return;
                }
            
                //Correct user issued a command, validate it now
                if(msg != "up" && msg != "down" && msg != "left" && msg != "right"){
                    //Invalid command
                    console.log("INVALID COMMAND");
                    socket.emit('consoleerror', "Invalid command!");
                    return;
                }
            
                //Correct user issued valid command, echo it to clients
                var moveObject = {
                    move: msg,
                    map: obj
                }
                
                if(curID == obj.user1){
                    //If player 1 just moved
                    moveObject.map.map.yourTurn = 2 ;
                    GAME_PAIR.p1.socket.emit('move', moveObject);
                    
                    moveObject.map.map.yourTurn = 1;
                    var temp = moveObject.map.map.tank1;
                    moveObject.map.map.tank1 = moveObject.map.map.tank2;
                    moveObject.map.map.tank2 = temp;

                    GAME_PAIR.p2.socket.emit('move', moveObject);
                    
                    
                }else{
                    //Player 2 just moved
                    moveObject.map.map.yourTurn = 1;
                    GAME_PAIR.p1.socket.emit('move', moveObject);
                    
                    moveObject.map.map.yourTurn = 2;
                    var temp = moveObject.map.map.tank1;
                    moveObject.map.map.tank1 = moveObject.map.map.tank2;
                    moveObject.map.map.tank2 = temp;
                    GAME_PAIR.p2.socket.emit('move', moveObject);
                }
                docs.map.yourTurn = (curID == obj.user1)?2:1;
                
            
                //Send users console message to indicate status
                if (curID == obj.user1) {
                    GAME_PAIR.p2.socket.emit('consolemsg', "It's your turn, enter a command.");
                    GAME_PAIR.p1.socket.emit('consolemsg', "Please wait, your opponent is selecting a move...");
                }
                else {
                    GAME_PAIR.p1.socket.emit('consolemsg', "It's your turn, enter a command.");
                    GAME_PAIR.p2.socket.emit('consolemsg', "Please wait, your opponent is selecting a move...");
                }

                //clients[(curID==obj.user1) ? obj.user2 : obj.user1].emit('consolemsg', "It's your turn, enter a command.");
                //clients[(curID==obj.user1) ? obj.user1 : obj.user2].emit('consolemsg', "Please wait, your opponent is selecting a move...");

                //We also need to modify the map on the server side so it knows the new state of the map.
                docs = applyMove(docs, msg, curID==obj.user1);
                console.log("Saving new state:");
                console.log(docs);
                gameModel.findOneAndUpdate( {$or:[{user1: socket.id}, {user2: socket.id}]}, docs, function(err, doc){
                    if (err) console.error(err);
                    return console.log("successfully updated.");
                });
            }
        );
    });
});

// configuration ===============================================================
//mongoose.connect(configDB.url); // connect to our database
mongoose.createConnection('mongodb://localhost/users');

require('./public/config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser()); // get information from html forms

app.set('view engine', 'ejs'); // set up ejs for templating

app.set('views', __dirname + '/public/views'); // set views directory in public

// required for passport
app.use(session({ secret: 'ilovescotchscotchyscotchscotch' })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./public/routes.js')(app, passport, io); // load our routes and pass in our app and fully configured passport

http.listen(3000, function(){
    console.log('listening on *:3000');
});