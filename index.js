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



let users = new Map();
let userResult = new Map();
let userWatchAds = new Map();
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
        sendDeatilsToFirebase(room, reportString, score, timeforsubmission, google_id, socket, genereateScore).then( console.log("firebase details sent"));

        
    });

    socket.on('watchAds', (userInfo) => {
        let googleid = userInfo.googleid;
        //let adstatus = userInfo.status;

        checkforDocument(googleid).then(()=>{

            const docc = getDoc(doc(db, "WatchAds", googleid));
            let stu = docc.data();
            let adsRemain = stu.AdsRemaining;
            if (adsRemain === 0){
                console.log("no ads AdsRemaining");
                socket.emit("noads");
            }else{
                console.log(`no AdsRemaining  ${adsRemain}`);
            }
        });
    
    });

});

server.listen(port, () => {console.log('listening on *:', port);});


//<-------------------------------------Functions are defined here--------------------------------------->

async function checkforDocument(googleid){
    const adsRem = await getDoc(doc(db, "WatchAds", googleid));
            if (!adsRem.exists()){
            const setAds = await setDoc(doc(db, "WatchAds", googleid), {
                "AdsRemaining" : 5
        });
    }
}
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

function genereateScore(room, report, score, socket, google_id){
    
     if (userResult.has(room)){
            let obj = {};
            obj["report"] = report;
            obj["score"] = score;
            obj["socketid"] = socket;
            obj["googleid"] = google_id;
            let old = userResult.get(room);

            let skt = old.socketid;
            
            let arr = [];
            arr.push(old);
            arr.push(obj);

            userResult.set(room, arr);
            let userArray = Array.from(users.get(room));
            let userResultArray = Array.from(userResult.get(room));
            
            let user1ticket = userArray[0].userTickets;
            let user1coin = userArray[0].userCoin;
            let user1googleid = userResultArray[0].googleid;
            let user2ticket = userArray[1].userTickets;
            let user2coin = userArray[1].userCoin;
            let user2googleid = userResultArray[1].googleid;

            console.log(`user 1 name - ${userArray[0].userName}`);
            console.log(`user 1 coins - ${user1coin}`);
            console.log(`user 1 ticket - ${user1ticket}`);
            console.log(`user 1 googleid - ${user1googleid}`);
            console.log(`user 2 name - ${userArray[1].userName}`);
            console.log(`user 2 coins - ${user2coin}`);
            console.log(`user 2 ticket - ${user2ticket}`);
            console.log(`user 2 googleid - ${user2googleid}`);
            

            if (skt.id === userArray[0].id){
                if (old.score > score){
                    updateWinner(user1googleid, user1coin, user1ticket, user2googleid);
                    updateRecord("WIN", user1googleid);
                    updateRecord("LOSE", user2googleid);
                }else{
                    updateWinner(user2googleid, user2coin, user2ticket, user1googleid);
                    updateRecord("LOSE", user1googleid);
                    updateRecord("WIN", user2googleid);
                }
            }else{
                if (old.score > score){
                    updateWinner(user2googleid, user2coin, user2ticket, user1googleid);
                    
                }else{
                    updateWinner(user1googleid, user1coin, user1ticket, user2googleid);
                }
            }

            userResult.delete(room);
            users.delete(room);

            console.log("--------------------Second end----------------------") ;
        }else{

              let obj = {};
            obj["report"] = report;
            obj["googleid"] = google_id;
            obj["score"] = score;
            obj["socketid"] = socket;
            userResult.set(room, obj);

    
            //console.log(userResult);
            console.log("--------------------first end----------------------") ;
        }
    }

async function updateWinner(userId, currCoins, currTickets, userId2){
    const snap = await doc(db, "Users", userId);
    const snap2 = await doc(db, "Users", userId2);

    await updateDoc(snap, {
    userCoins: currCoins + 5,
    userTickets : currTickets - 1
    });

    await updateDoc(snap2, {
    userTickets : currTickets - 1
    });
}

async function sendDeatilsToFirebase(room, report, score, timetaken, googleid, socket, callback){
    
    let jv = {
        "report" : report,
        "score" : score,
        "time" : timetaken,
        "googleId" : googleid
    };

    //console.log(jv);
    const docRef = await addDoc(collection(db, "Tip", "result", room), jv);
    callback(room, report, score, socket, googleid);
    
}

async function updateRecord(gameStatus, userId){

    var date = new Date();
    let recordData = {
        status : gameStatus, 
        timestamp : date
    };
    const docReff = await addDoc(collection(db, "Tip", "history", userId), recordData);
};


//waht happen

    //console.log what the hell is wrong 
    /*socket.on('get_result', (room) =>{
        
    });*/


/*
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

            
            
          /*  skt.disconnect();
            socket.disconnect();
            console.log(`both sockets disconnected`);
            userResult.delete(room);
            users.delete(room);*/
       
    /*    } else{

            let obj = {};
            obj["report"] = report;
            obj["googleid"] = google_id;
            obj["score"] = score;
            obj["socketid"] = socket;
            userResult.set(room, obj);

    
            //console.log(userResult);
            console.log("--------------------first end----------------------") ;
        }*/