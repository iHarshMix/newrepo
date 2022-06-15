import path from 'path'
import express from 'express'
import http from 'http'
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDoc, doc, updateDoc, addDoc } from "firebase/firestore";
import { Server } from "socket.io";
const __dirname = path.resolve();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3001

const firebaseConfig = {
  apiKey: "AIzaSyDFW0W_yhlyKusYRW8xwNtIZqhiJxQZVp8",
  authDomain: "robo-mathque.firebaseapp.com",
  projectId: "robo-mathque",
  storageBucket: "robo-mathque.appspot.com",
  messagingSenderId: "869425345296",
  appId: "1:869425345296:web:9ac3b6e1349c2732bf6b95",
  measurementId: "G-EE2VXEQXHM"
};

const app2 = initializeApp(firebaseConfig);
const db = getFirestore(app2);


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});




let users = new Map();
let userResult = new Map();
//let userResult = [];
let usersInRoom = [];

io.on('connection', (socket) => {

    socket.on("joinRoom", (usertype)=> { 
        let user = { 
            "socket" : socket, 
            "id": socket.id, 
            "roomType": usertype.type, 
            "userName": usertype.username,
            "userCoin": usertype.usercoins,
            "userTickets": usertype.usertickets, };

    

    //console.log(type.type)
    usersInRoom.push(user);

    if (isEnoughUsers()){

        let socket1 = usersInRoom[0].socket;
        let socket2 = usersInRoom[1].socket;
        let roomName = createUuid();

        socket1.join(roomName);
        socket2.join(roomName);

        users.set(roomName, usersInRoom);
        socket1.emit('room_joined', { room : roomName, username : usersInRoom[1].userName} );
        socket2.emit('room_joined', { room : roomName, username : usersInRoom[0].userName} );

        if (usersInRoom[0].roomType === "easy"){
            let listofquestions = JSON.stringify(generateEasyQuestions());
            socket1.emit('questions', { questions: listofquestions} );
            socket2.emit('questions', { questions: listofquestions} );
            usersInRoom = [];
        }else{
            let listofquestions = JSON.stringify(generateHardQuestions());
            socket1.emit('questions', { questions: listofquestions} );
            socket2.emit('questions', { questions: listofquestions} );
            usersInRoom = [];
        }
        
    } 
    else { socket.emit("message", { msg : "waiting for other user" }); } });

    socket.on('message_other', (msg, room) => { io.to(room).emit("message", msg); });

    socket.on("disconnecting", (reason) => { console.log(`reason: ${reason}`);

            let w = 0;
            for (let i of users.keys()){
                //console.log(i);
                let userr = Array.from(users.get(i));
                if (socket.id === userr[0].id){
                    console.log(`user left with users id : ${userr[0].id}`);
                    io.to(userr[1].id).emit('message', "other user disconnected");
                    users.delete(i);
                    w = 1;
                    break;
                }else{
                    console.log(`user left with users id : ${userr[1].id}`);
                    io.to(userr[0].id).emit('message', "other user disconnected");
                    users.delete(i);
                    w = 1;
                    break;
                }
            }

            if (w === 0){
                usersInRoom = [];
            }
        
     });

    socket.on('disconnect', ()=>{ console.log(`user disconnected`); });

    socket.on('update_score', (info)=> {
     
        let report = info.report;
        let room = info.room;
        let google_id = info.google_id;
        let timeforsubmission = info.time;
        let userOfflineScore = info.score;

        let temp_score = 0;
        for (let i = 0 ; i < report.length; i++){
            if (report[i].yourans === report[i].correctans){
                temp_score++;
            }
        }

        let reportString = JSON.stringify(report);

        sendDeatilsToFirebase(room, reportString, temp_score, timeforsubmission, google_id);

        
    });

        //console.log what the hell is wrong 
    socket.on('get_result', (room) =>{
        if (userResult.has(room.room)){
            let old = Array.from(userResult.get(room.room));
            //console.log(old[0].report);
            //console.log(old[1].report);
            if (!old[0].report && !old[1].report){
                socket.emit("user_results", {"firstReport" : old[0].report, "secondReport" : old[1].report});
            }else{
                if (!old[0].report){
                    socket.emit("user_results", {"firstReport" : old[0].report, "error" : "other user left"});
                }
                else{
                    socket.emit("user_results", {"firstReport" : old[1].report, "error" : "other user left"});
                }
            }
            
            userResult.delete(room.room);
        }else{
            console.log(`waiting for other user's report -> get_result`);
        }
    });
  
});

server.listen(port, () => {console.log('listening on *:', port);});


//<-------------------------------------Functions are defined here--------------------------------------->
function isEnoughUsers() { return usersInRoom.length === 2; }
function generateEasyQuestions() {let questions = {}; 
    for (let sno = 1; sno <= 5; sno++){
        let num1 = Math.floor((Math.random() * 100) + 1);
        let num2 = Math.floor((Math.random() * 100) + 1);
        let solution = num1 + num2;

            var question = {

                "firstValue" : num1,
                "secondValue": num2,
                "solution": solution
            };

            questions[sno.toString()] = question;
        }
        return questions;}

function generateHardQuestions(){
    //let questions = {};
}
function removeUser(room) { users.delete(room);}
function createUuid() { var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid; }

async function updateScore(userId, currCoins, currTickets){
    const snap = await doc(db, 'Users', userId);
    await updateDoc(snap, {
    userCoins: 20
    });
}

async function sendDeatilsToFirebase(room, report, score, timetaken, googleid){
    
    let jv = {
        "report" : report,
        "score" : score,
        "time" : timetaken,
        "googleId" : googleid
    };

    const docRef = await addDoc(collection(db, room), jv);
}


