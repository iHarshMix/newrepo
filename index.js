import path from 'path'
import express from 'express'
import http from 'http'
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDoc, doc, updateDoc, addDoc, setDoc } from "firebase/firestore";
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

//updateRecord("WIN", "101411107148464225590");


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

        let score = 0;
        for (let i = 0 ; i < report.length; i++){
            if (report[i].yourans === report[i].correctans){
                score++;
            }
        }

        let reportString = JSON.stringify(report);
        sendDeatilsToFirebase(room, reportString, score, timeforsubmission, google_id);

        if (userResult.has(room)){
            let obj = {};
            obj["report"] = report;
            obj["googleid"] = google_id;
            obj["score"] = score;
            obj["socketid"] = socket;
            let old = userResult.get(room);

            let skt = old.socketid;
            
            let arr = [];
            arr.push(old);
            arr.push(obj);

            userResult.set(room, arr);
            let userArray = Array.from(users.get(room));
            
            let user1ticket = userArray[0].userTickets;
            let user2ticket = userArray[1].userTickets;
            let user1coin = userArray[0].userCoin;
            let user2coin = userArray[1].userCoin;

            console.log("--------------------Second end----------------------") ;

            if (skt.id === userArray[0].id){
                if (old.score > score){
                    
                    updateWinner(old.googleid, user1coin, user1ticket, google_id);
                    
               
                }else{

                    updateWinner(google_id, user2coin, user2ticket, old.googleid);
                      
                }
            }else{
                if (old.score > score){

                    //updateRecord("LOSE", google_id);
                    updateWinner(google_id, user2coin, user2ticket, old.googleid);
                    
                }else{
                  // updateRecord("WIN", old.googleid);
                    updateWinner(old.googleid, user1coin, user1ticket, google_id);
          
                }
            }
            
            skt.disconnect();
            socket.disconnect();
            console.log(`both sockets disconnected`);
            userResult.delete(room);
            users.delete(room);
       
        } else{

            let obj = {};
            obj["report"] = report;
            obj["googleid"] = google_id;
            obj["score"] = score;
            obj["socketid"] = socket;
            userResult.set(room, obj);

    
            //console.log(userResult);
            console.log("--------------------first end----------------------") ;
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


function removeUser(room) { users.delete(room);}
function createUuid() { var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid; }



async function updateWinner(userId, currCoins, currTickets, userId2){
    const snap1 = await doc(db, userId);
    const snap2 = await doc(db, userId2);

    await updateDoc(snap1, {
    userCoins: currCoins + 5,
    userTickets : currTickets - 1
    });

    await updateDoc(snap2, {
    userTickets : currTickets - 1
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
    console.log("send detail to firebase")
}

async function updateRecord(gameStatus, userId){

    var d = new Date();
    let recordData = {
        status : gameStatus, 
        timestamp : d
    };
    const docReff = await addDoc(collection(db, "Tip", "history", userId), recordData);
};

//waht happen

    //console.log what the hell is wrong 
    /*socket.on('get_result', (room) =>{
        
    });*/