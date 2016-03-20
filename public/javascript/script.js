//Boardstate:
    

var DrawInstance = function(canvasParam){
    var playerImage = new Image();
    playerImage.src = "assets/images/tank_player.png";
    var enemyImage = new Image();
    enemyImage.src = "assets/images/tank_enemy.png";
    var boardState = {}; //Initialized in init
    var canvas;
    var ctx;
    var cellWidth = 200; //Width of one cell
    var cellHeight = 200;//Height of one cell
    var borderWidth = 8;//Width of border between cells
    var freeColor = "#D0D0D0";
    var wallColor = "#2f2f2f";
    var width;
    var height;

    //If we're drawing other stuff above/to the left of the grid, the entire grid will need to be
    //offset by some amount left and above.
    var offsetLeft = 0;
    var offsetAbove = 0;

    //Note: HTML5 canvas coordinates go like this:
    //   0  1  2  3  4  X
    // 0   
    // 1
    // 2
    // 3
    // 4
    // Y

    //i.e. (0, 0) is upper left, not lower left. Same will be true for the array.
    
    //Converts an (x, y) canvas coordinate into an array index
    this.coordToIndex = function(x, y){ 
        return {"x": Math.floor((x - offsetLeft)/(cellWidth+borderWidth)),
                "y": Math.floor((y - offsetAbove)/(cellHeight+borderwidth))};
    }

    //Converts an array index into the coordinate of the upper left of a cell
    this.indexToCoord = function(x, y){
        return {"x": offsetLeft + borderWidth + (x*(cellWidth+borderWidth)),
                "y": offsetAbove + borderWidth + (y*(cellHeight+borderWidth))};
    }

    //Draws grid to canvas
    this.drawGrid = function(){
        
        ctx.fillStyle = "#7f7f7f";
        //Vertical lines
        for(var i = 0; i<width; i+=cellWidth + borderWidth){
            ctx.fillRect(i + offsetLeft, offsetAbove, borderWidth, height);
        }
        //Horizontal lines
        for(var i = 0; i<height; i+=cellHeight + borderWidth){
            ctx.fillRect(offsetLeft, i + offsetAbove, width, borderWidth);
        }
    }
    
    //For testing my indexes and shit are correct
    this.fillIndex = function(x, y, color){
        ctx.fillStyle = color; //A lovely baby blue
        var coordinates = this.indexToCoord(x, y);
        ctx.fillRect(coordinates.x, coordinates.y, cellWidth, cellHeight);
    }

    this.boardUpdate = function(){
        //Draw background
        ctx.fillStyle = freeColor;
        ctx.fillRect(offsetLeft, offsetAbove, width, height);
        
        this.drawGrid();
        
        //Fill grid
        var board = boardState.map;
        for(var i = 0; i < boardState.width; i++){
            for(var j = 0; j<boardState.height; j++){
                this.fillIndex(i, j, (board[j][i]=="X")?wallColor:freeColor);
            }
        }
        
        //Draw Tanks
        //Player tank
        var playerCoords = this.indexToCoord(boardState.playertank.x, boardState.playertank.y);
        ctx.drawImage(playerImage, playerCoords.x, playerCoords.y, cellWidth, cellHeight);
        
        //Enemy tank
        var enemyCoords = this.indexToCoord(boardState.enemytank.x, boardState.enemytank.y);
        ctx.drawImage(enemyImage, enemyCoords.x, enemyCoords.y, cellWidth, cellHeight);
    }
    
    this.command = function(command, tankNum){
        console.log("MOVING TANK NUM: " + tankNum);
        var tank = (tankNum==2)?boardState["enemytank"]:boardState["playertank"];
        console.log(tank);
        if(tank.dir == command){
            console.log("making a move");
            //We're making a move
            var xChange, yChange;
            switch(command){
                case "up":
                    yChange = -1;
                    xChange = 0;
                    break;
                
                case "down":
                    yChange = 1;
                    xChange = 0;
                    break;
                    
                case "left":
                    yChange = 0;
                    xChange = -1;
                    break;
                    
                case "right":
                    yChange = 0;
                    xChange = 1;
                    break;
            }
            
            var target = boardState.map[tank.y + yChange][tank.x + xChange];
            //add thing to make sure tanks can't intersect
            if(target == "A"){
                console.log("Move successful");
                tank.x += xChange;
                tank.y += yChange;
            }else{
                console.log("Hit a wall");
            }
        }else {//Otherwise we're just changing direction
            console.log("Was facing: " + tank.dir);
            tank.dir = command;
            console.log("Now facing: " + tank.dir);
        }
        console.log("---------------");
        this.boardUpdate();
    }
    
    this.init = function(map){
        console.log(map);
        //Parse map object
        var board = map.board.split(".").map(function(x){return x.split("");});
        ///Initialize board state
        boardState["width"] = board[0].length;
        boardState["height"] = board.length;
        boardState["map"] = board;
        boardState["playertank"] = map.tank1;
        boardState["enemytank"] = map.tank2;
        console.log("INIT TANK:");
        console.log(map.tank1);
        console.log(map.tank2);

        width = (boardState["width"] * cellWidth) + ((boardState["width"]+1) * borderWidth); //Width of grid
        height = (boardState["height"] * cellHeight) + ((boardState["height"]+1) * borderWidth); //Height of grid

        //Sets internal canvas dimensions, not front end dimensions
        //set those in CSS
        canvas.width = width + offsetLeft;
        canvas.height = height + offsetAbove;

        this.boardUpdate();
    }
    canvas = canvasParam;
    ctx = canvas.getContext("2d");
}
