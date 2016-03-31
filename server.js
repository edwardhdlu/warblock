//REQUIRES
var express = require("express");
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var clone = require('clone');
var clients = {};

ONLINE_USERS = [];

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
    map: Object
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
    //ADD USER TO ACTIVE CLIENTS LIST
    clients[socket.id] = socket;
    debug("Number of users: " + Object.keys(clients).length);
    
    if(Object.keys(clients).length == 2){
        //2 users, match them
        var count = 0;
        var userIDs = [];
        for(key in clients){
            if (clients.hasOwnProperty(key)) {
                userIDs[count] = key;
                count++;
            }
        }
        
        debug("Attempting to create gamestate for users: ");
        
        //INTIALIZE MAP
        var map = {
            board: "XXXXXXXXXXXXX.XAAAAAAAAAAAX.XAAAAAAAAAAAX.XAAAAAAAAAAAX.XAAAAAAAAAAAX.XAAAAAAAAAAAX.XXXXXXXXXXXXX",          
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
        
        var newGame = new gameModel({user1: userIDs[0], user2: userIDs[1], map: map});
        newGame.save(function(err, result){
            if(err){
                console.error(err);
            }else{
                debug("Game created: " + result);
                count =1;
                for(key in clients){
                    if(clients.hasOwnProperty(key)){
                        map.opponentID = userIDs[count];
                        if(!count){
                            var temp = map.tank1;
                            map.tank1 = map.tank2;
                            map.tank2 = temp;
                            map.yourTurn = 0;
                        }
                        clients[key].emit('game init', map);
                        count--;
                    }
                }
            }
        })
        
    }
    
    socket.on('disconnect', function(){
        debug("User disconnected: " + socket.id);
        delete clients[socket.id];
        debug("Number of users: " + Object.keys(clients).length);
        
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
                    clients[otherUser].emit('opponent disconnected', 0);
                } 
            }
        );
        
        
    });
    
    socket.on('command', function(msg){
        console.log('command: ' + msg);
        gameModel.findOne( {$or:[{user1: socket.id}, {user2: socket.id}]}, 
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
                    clients[obj.user1].emit('move', moveObject);
                    
                    moveObject.map.map.yourTurn = 1;
                    var temp = moveObject.map.map.tank1;
                    moveObject.map.map.tank1 = moveObject.map.map.tank2;
                    moveObject.map.map.tank2 = temp;
                    clients[obj.user2].emit('move', moveObject);
                    
                    
                }else{
                    //Player 2 just moved
                    moveObject.map.map.yourTurn = 1;
                    clients[obj.user1].emit('move', moveObject);
                    
                    moveObject.map.map.yourTurn = 2;
                    var temp = moveObject.map.map.tank1;
                    moveObject.map.map.tank1 = moveObject.map.map.tank2;
                    moveObject.map.map.tank2 = temp;
                    clients[obj.user2].emit('move', moveObject);
                }
                docs.map.yourTurn = (curID == obj.user1)?2:1;
                
            
                //Send users console message to indicate status

                clients[(curID==obj.user1)?obj.user2:obj.user1].emit('consolemsg', "It's your turn, enter a command.");
                clients[(curID==obj.user1)?obj.user1:obj.user2].emit('consolemsg', "Please wait, your opponent is selecting a move...");

                //We also need to modify the map on the server side so it knows the new state of the map.
                docs = applyMove(docs, msg, curID==obj.user1);
                console.log("Saving new state:");
                console.log(docs);
                gameModel.findOneAndUpdate( {$or:[{user1: socket.id}, {user2: socket.id}]}, docs, {upsert:true}, function(err, doc){
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