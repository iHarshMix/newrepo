const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = process.env.PORT || 3001

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let roomName = 0;
let users = new Map();
let usersInRoom = [];

io.on('connection', (socket) => {

    socket.on("joinRoom", ()=> { let user = { "socket" : socket, "id": socket.id };

    usersInRoom.push(user);

    if (isEnoughUsers()){

        let socket1 = usersInRoom[0].socket;
        let socket2 = usersInRoom[1].socket;

        socket1.join(roomName);
        socket2.join(roomName);

        users.set(roomName, usersInRoom);
        socket1.emit('room_joined', roomName);
        socket2.emit('room_joined', roomName);

        let listofquestions = JSON.stringify(generateEasyQuestions());
        socket1.emit('questions', listofquestions);
        socket2.emit('questions', listofquestions);

        usersInRoom = [];
        roomName++;
  
    } 
    else { 

        socket.emit("message", "waiting for other user"); }} );

        socket.on('message_other', (msg, room) => { io.to(room).emit("message", msg); });

        socket.on('disconnect', () => { console.log(`disconnected`); });

    socket.on('remove_user', (room)=>{  users.delete(room); });

    socket.on('disconnect', ()=>{ console.log(`user disconnected`); })

  
});

server.listen(port, () => {console.log('listening on *:', port);});


//<-------------------------------------Functions are defined here--------------------------------------->
isEnoughUsers = () => usersInRoom.length === 2;
generateEasyQuestions = () => {let questions = {}; 
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