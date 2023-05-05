import path, { win32 } from 'path'
import express from 'express'
import http from 'http'
import {Server} from "socket.io";
import { create_user, user_game_win, user_game_lost, user_game_exited } from "./config.js";
import { error } from 'console';
const __dirname = path.resolve();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3001


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});


const appversion = "2.5";
const serverWork = false;

const waitingUsers = new Map();
const usersInGame = new Map();
const socketToId = new Map()        //map for storing socket id with google ids 
const currentUsers = new Map();
const userAnswers = new Map();
const userResults = new Map();


io.on('connection', (socket) => {

//-------------------------------------1. Check Update Or Server Maintainence ----------------------------------------//
socket.on('check_update', (info)=>{
    let version = info.version;
    if (serverWork) {
        socket.emit('update', { "error": "001"}); ////////Server Maintenance /Error->
    } else if (appversion !== version) {
        socket.emit('update', {"error": "002"});  /////////Updare Available Error->
    } else {
        socket.emit('update', {"error": "003"});  /////////Everything Fine  Error->
    }
});


//-------------------------------------2. User Connects To The Server ------------------------------------------------//
    socket.on('user_connect', (data)=> {
        
        if ( currentUsers.has(data.googleId) ) {
            console.log(`user already in the room`);
            socket.emit('user_created', { "userData" : getUserData(data.googleId) , "isNewUser" : false });
            return;
        }

        const user = create_user(data.googleId, data.name);
        user.then(([userData, isNewUser])=> { 
            //currentUsers.set(socket.id, userData); 
            currentUsers.set(data.googleId, userData);
            socketToId.set(socket.id, data.googleId);
            socket.emit('user_created', { "userData" : getUserData(data.googleId) , "isNewUser" : isNewUser });

        }).catch(err => { throw err; })
        
     
    });

//------------------------------------- User Wants To Join Online Game ---------------------------------------------//
    socket.on('join_game', ()=> {
        let googleId = socketToId.get(socket.id);
        var user_data = currentUsers.get(googleId);
        if (user_data){
            let user = {
                "socket" : socket,
                "googleId" : user_data["googleId"],
                "userName" : user_data["userName"],
                "type" : "real",
                "userTickets" : user_data["userTickets"],
                "userCoin" : user_data["userCoin"]
            };
            
            waitingUsers.set(googleId, user);
        }else{
            console.log("no such user") /////////Error->
        }
       
    });

//------------------------- User Wants to Exit MatchMaking---------------------------------------//
/*    socket.on("exit_room", ()=> {
        let googleId = socketToId.get(socket.id);
        if ( currentInterval <= 3 ) {
            waitingUsers.delete(googleId);
            socket.emit("exitRoom", {"error" : "004"}); // can exit room
        } else {
            socket.emit("exitRoom", {"error" : "005"}); // cannot exit 
        }
    });*/


//------------------------------------- User Exits A Game ------------------------------------------------//
    socket.on('exit_game', (room) =>  {
        if (usersInGame.delete(room)) {
            console.log("users removed");
        }else{
            console.log("users already removed");
        }
    });


//------------------------------------- Generate User Result ---------------------------------------------//
    socket.on('gen_result', async (data) =>{
        //console.log(data["room"]);
        //console.log(data["queAns"]);
        let room = data["room"];
        let sol = data["queAns"];
        if (userAnswers.has(room)){
            let prevsol = userAnswers.get(room);
            let res = result(sol, prevsol, room);
            res.then(()=>{
                console.log("result generated");
                userAnswers.delete(room);
            })
            .catch(err => { console.log(err); })
        }else{
            userAnswers.set(room, sol);
        }

    });

 
//------------------------------------- User Retrieve Result ------------------------------------------------//
    socket.on("user_result", (room)=>{
        let res = getMatchResult(room);
        if (res == null){
            socket.emit('user_result', "not yet generated");
        }else{
            socket.emit('user_result', res);
        }
    })

//------------------------------------- Retrieve User Data ------------------------------------------------//
    socket.on("get_data", (data)=>{
        let googleId = data.googleId;
        let userData = currentUsers.get(googleId);
        socket.emit("user_data", userData);
    })


//------------------------------------- User Exits The Server ------------------------------------------------//
    socket.on("disconnecting", (reason) => {
    
        console.log(`user exited for reason ${reason}`);
        let googleId = socketToId.get(socket.id);
        currentUsers.delete(googleId);
        if (!waitingUsers.delete(googleId)) {
            let found = false;
            for (let [room, users] of usersInGame.entries()){
                if (users[0].googleId === googleId){
                    io.to(room).emit('error', users[0].name);
                    usersInGame.delete(room);
                    found = true;
                    // give penalty to user
                    break;
                }

                if (users[1].googleId === googleId){
                    io.to(room).emit('error', users[1].name);
                    usersInGame.delete(room);
                    found = true;
                    // give penalty to user
                    break;
                }
                
            }

        }

    });

});


setInterval(begin, 5000);

server.listen(port, () => {
    console.log('listening on *:', port);
});



//----------------------------------------------------FUNCTIONS-------------------------------------------------------------//

async function result(sol1, sol2, room){
    let crct1 = 0, crct2 = 0;
    let gId1 = "", gId2 = "";
    for (const que in sol1){
        let uR = sol1[que];
        gId1 = uR.googleId;
        if (uR.solution === uR.userAns){
            crct1++;
        }
    }

    for (const que in sol2){
        let uR2 = sol2[que];
        gId2 = uR2.googleId;
        if (uR2.solution === uR2.userAns){
            crct2++;
        }
    }

    let winId = crct1 >= crct2 ? gId1 : gId2;
    let loseId = crct1 >= crct2 ? gId2 : gId1;

    console.log(winId);
    

    let winData = currentUsers.get(winId);
    let loseData = currentUsers.get(loseId);
    /*let winUserTickets = winData["userTickets"];
    let winUserCoins = winData["userCoins"];
    let loseUserTickets = winData["userTickets"];*/


    let resRoom = {
        "winId" : winId,
        "loseId" : loseId,
        "winRes" : sol1,
        "loseRes" : sol2
    }

    //console.log(winUserCoins);
    //console.log(loseUserTickets);

    console.log(winData);
    console.log(loseData);

    //await user_game_win(winId, winUserCoins,winUserTickets);
    //await user_game_lost(loseId, loseUserTickets);
    userResults.set(room, resRoom);

}

async function begin() {

    currentInterval += 1;

    console.log(`current interval is: ${currentInterval}`);

    io.sockets.emit('current_users', getLiveUsers());
    console.log(`current users: ${getLiveUsers()}`);
    pairUsers().then((res)=>{
        if (res){
            console.log("not enough users");
        }else{
            console.log("some error");
        }
    });

    if ( currentInterval >= 5 ) {
        currentInterval = 0;
    }

}


async function pairUsers() {
    
    try{
        if (waitingUsers.size >= 2){

            //generate random room id
            let room =  await getRoom();

            //get random first user
            let id1 = await getRandomUser();
            let user1 = waitingUsers.get(id1);
            user1.socket.join(room);
            waitingUsers.delete(id1);
            
            //get random second user
            let id2 = await getRandomUser();                   
            let user2 = waitingUsers.get(id2);
            user2.socket.join(room);
            waitingUsers.delete(id2);

            //adding both users to userInGame room
            usersInGame.set(room, [user1, user2]);

            //generating questions
            var que = await generateEasyQuestions();
            io.to(room).emit("room_joined", { "room" : room, "questions" : que }); 
   
            return await pairUsers();
        }
        else{
           return true;
        }

    }catch (err){
        console.log(err);
        return false;
    }
    
}


async function getRandomUser(){
    let val = waitingUsers.keys().next().value;
    return val;
};

function getLiveUsers(){
    return currentUsers.size;
}

async function getRoom() {
    let room = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < 5) {
      room += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return room;
    
}

async function generateEasyQuestions() {
    let questions = {};
    for (let sno = 1; sno <= 5; sno++) {

        var num1 = Math.floor((Math.random() * 100) + 1);
        var num2 = Math.floor((Math.random() * 100) + 1);
        var equation = num1.toString() + " + " + num2.toString() + " = ";
        var solution = num1 + num2;
        var question = {
            "equation": equation,
            "solution": solution
        };

        questions[sno.toString()] = question

    }

    return questions;
}

function getMatchResult(room){
    return userResults.get(room);
}

function getUserData(id){
    return currentUsers.get(id);
}


//-------------------------------------garbage code-------------------------------------------------//
  //resetTime--;
    //if (resetTime === 0){

       
        /*else{
            console.log(`not enough users`);
            let user = {
                "socket": null,
                "id": null,
                "name" : "bot",
                "type" : "bot"
            };
            //pairUsers();
           // console.log(`added bot\nno. of users : ${waitingUsers.length}`);
        }*/
     //   resetTime = 5;
    //}

  /*let cnt = 3;
    while (cnt > 0) {
            console.log(`size is : ${waitingUsers.size}`);
            if (waitingUsers.size >= 2){
                pairUsers();
            }else{
                console.log("not enough users");
                break;
            }
            
            cnt--;
        }*/