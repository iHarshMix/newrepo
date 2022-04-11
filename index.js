import express from 'express'
const app = express();
import http from 'http'
const server = http.createServer(app);
import { Server } from "socket.io";
const io = new Server(server);
const port = process.env.PORT || 3001
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDoc, doc, updateDoc } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDu2afD9seUM-Cigy0WHhEVjgGPcqMoUZI",
  authDomain: "mathque-7c80e.firebaseapp.com",
  databaseURL: "https://mathque-7c80e-default-rtdb.firebaseio.com",
  projectId: "mathque-7c80e",
  storageBucket: "mathque-7c80e.appspot.com",
  messagingSenderId: "576042213006",
  appId: "1:576042213006:web:7253371bb48cf3f5f8b3df"
};


const app2 = initializeApp(firebaseConfig);
const db = getFirestore(app2);

const snap = await doc(db, 'Users', '101411107148464225590');
await updateDoc(snap, {
  userCoins: 82
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});





let users = new Map();
let usersInRoom = [];

io.on('connection', (socket) => {

    socket.on("joinRoom", (username)=> { let user = { "socket" : socket, "id": socket.id };

    usersInRoom.push(user);

    if (isEnoughUsers()){

        let socket1 = usersInRoom[0].socket;
        let socket2 = usersInRoom[1].socket;
        let roomName = createUuid();

        socket1.join(roomName);
        socket2.join(roomName);

        users.set(roomName, usersInRoom);
        socket1.emit('room_joined', { room : roomName} );
        socket2.emit('room_joined', { room : roomName});

        let listofquestions = JSON.stringify(generateEasyQuestions());
        socket1.emit('questions', { questions: listofquestions} );
        socket2.emit('questions', { questions: listofquestions} );

        usersInRoom = [];
  
    } 
    else { socket.emit("message", "waiting for other user"); } });

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
  
});

server.listen(port, () => {console.log('listening on *:', port);});


//<-------------------------------------Functions are defined here--------------------------------------->
function isEnoughUsers() { usersInRoom.length === 2; }
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



//<---------------------------------Garbage--------------------------------->//
