import path from 'path'
import express from 'express'
import http from 'http'
import {initializeApp} from "firebase/app";
import {getFirestore, collection, getDoc, doc, updateDoc, addDoc, setDoc} from "firebase/firestore";
import {Server} from "socket.io";
//import { getAuth } from 'firebase/auth';
//import {version} from 'os';

const __dirname = path.resolve();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3001

const appversion = "2.5";
const serverWork = false;

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
//let userWatchAds = new Map();
//let userResult = [];
let usersInRoom = [];

io.on('connection', (socket) => {

    socket.on("joinRoom", (usertype) => {
        console.log(`${usertype.username} connected to the server`);
        let user = {
            "socket": socket,
            "id": socket.id,
            "googleid" : usertype.googleid,
            "userName": usertype.username,
            "userCoin": usertype.usercoins,
            "userTickets": usertype.usertickets,
        };

        if (usersInRoom.length > 0){
            let previousUser = usersInRoom[0];
            if (previousUser.id === socket.id){
                console.log("need other user");
            }else{
                usersInRoom.push(user);
                addUsersToRoom().then(() => {
                usersInRoom = [];
                console.log("users Added to the room");
            });
            }
        }else{
            usersInRoom.push(user);
        }

       /*  usersInRoom.push(user);

        if (usersInRoom.length === 2) {
            addUsersToRoom().then(() => {
                usersInRoom = []
                console.log("users Added to the room")
            });
        }
       */
    });

    socket.on("exitRoom", () => {
        console.log("room exited");
        usersInRoom = []
    });

    socket.on('message_other', (msg, room) => {
        io.to(room).emit("message", msg);
    });

    socket.on("disconnecting", (reason) => {
        console.log(`reason: ${reason}`);
        try{
            for (let i of users.keys()) {
                let userr = Array.from(users.get(i));
                if (socket.id === userr[0].id) {
                    console.log(`user left with users name : ${userr[0].userName}`);
                    let str = userr[0].userName + " left the game and will be penalized";
                    io.to(userr[1].id).emit('message', {msg: str});
                    let googleid = userr[0].googleid;
                    let usertick = userr[0].userTickets;
                    updateTickets(googleid, usertick, "dec").then(()=>{
                        users.delete(i);
                    });
                    break;
            
                } else if (socket.id === userr[1].id) {
                    console.log(`user left with users username : ${userr[1].userName}`);
                    let str = userr[1].userName + " left the game and will be penalized";
                    io.to(userr[0].id).emit('message', {msg: str});
                    let googleid = userr[1].googleid;
                    let usertick = userr[1].userTickets;
                    updateTickets(googleid, usertick, "dec").then(()=>{
                        users.delete(i);
                    });
                    break;
                
                } else{
                    console.log("user left but was not in room");
                }
        }

        }catch(err){
            console.log(err.message);
        }
       
    });

    socket.on('checkUpdate', (info) => {
        let version = info.version;
        if (serverWork) {
            socket.emit('update', {msg: "Server Maintenance!! \n \n Please wait some server work needs to be done"});
        } else if (appversion !== version) {
            socket.emit('update', {msg: "Updare Available!! \n \n Please update your app to continue"});
        } else {
            socket.emit('noupdate');
        }
    });

    socket.on('disconnect', () => {
        console.log(`user disconnected`);
    });

    socket.on('update_score', (info) => {
        let report = info.report;
        let reportPractice = info.reportPractice;
        let room = info.room;
        let google_id = info.google_id;
        let timeForSubmission = info.time;
        let userOfflineScore = info.score;

        
        let score = 0;
        for (let i = 0; i < report.length; i++) {
            if (report[i].yourans === report[i].correctans) {
                score++;
            }
        }

        let reportString = JSON.stringify(report);
        let reportStringPractice = JSON.stringify(reportPractice);

        if (room === "practice") {
            let user1 = {
                "googleid": google_id,
                "time": timeForSubmission,
                "score": score,
                "report": reportString,
            };

            let user2 = {
                "googleid": "na",
                "time": 0,
                "score": 0,
                "report": reportStringPractice,
            };

            sendDetailsToFirebase2(google_id, user1, user2, generateScore2).then(() => {
                console.log("firebase details sent");
            });

        } else {

            if (userResult.has(room)) {

                console.log("-------------------update score second -----------------------");
                console.log(`google id of user is : ${google_id}`);

                let old = userResult.get(room);

                let user1 = {
                    "googleid": old.googleid,
                    "time": old.time,
                    "score": old.score,
                    "report": old.report,
                };

                let user2 = {
                    "googleid": google_id,
                    "time": timeForSubmission,
                    "score": score,
                    "report": reportString,
                };

                sendDetailsToFirebase2(room, user1, user2, generateScore2).then(() => {
                    userResult.delete(room);
                    users.delete(room);
                    console.log("firebase details end");
                });

            } else {

                console.log("-------------------update score first -----------------------");
                console.log(`google id of user is : ${google_id}`);

                let jv = {
                    "googleid": google_id,
                    "time": timeForSubmission,
                    "score": score,
                    "report": reportString,
                };
                userResult.set(room, jv);
            }
        }

    });

    socket.on('watchAds', (info)=>{
        let googleid = info.googleid;
        let adstatus = info.status;
        //console.log("watch ads called");
        checkforDocument(googleid).then(() => {
            console.log("ads update succesful");
        });

    });

  

    socket.on('payout', (info) => {
        console.log("payout called----------------");
        let type = info.type;
        let amount = info.amount;
        let googleid = info.googleid;
        addPayoutInfo(type, amount, googleid).then(()=>{
            console.log("payout updated");
        });

    });

    socket.on('newaccount', (info) => {
        let googleid = info.googleid;
        createNewAccount(googleid);
    });

    socket.on('dailyReward', (info)=>{
        let googleid = info.googleid;
        isAvailable(googleid, socket);
    });


});

server.listen(port, () => {
    console.log('listening on *:', port);
});

//<-------------------------------------Functions are defined here--------------------------------------->
async function isAvailable(googleid, socket){
    const tik = await getDoc(doc(db, "Users", googleid));
    let tikk = tik.data();
    let userTick = tikk.userTickets;
    let old_date = tikk.rewardTime;
    let d = new Date();
    let new_date = d.getDate();
    
    if (new_date - old_date === 0){
        socket.emit('reward', {val : 0});
        console.log("zero baby");
    } else {
        var quetype = [2, 2, 2, 2, 3, 3, 3, 4, 4, 5];
        var tickAmount = quetype[Math.floor(Math.random() * 10)];
        userTick += tickAmount
        updateReward(googleid, new_date, userTick).then(()=>{
            socket.emit('reward', {val : tickAmount});
            console.log("time updated");
        });
    
    }
}

async function updateReward(userId, day, tick){
    try {
         
        const snapp = await doc(db, "Users", userId);
        await updateDoc(snapp, { rewardTime: day , userTickets : tick});
    
    }
    catch(err){
        console.log(err.message);
    }
};

async function addUsersToRoom() {
    let socket1 = usersInRoom[0].socket;
    let socket2 = usersInRoom[1].socket;
    let roomName = createUuid();

    users.set(roomName, usersInRoom);
    socket1.join(roomName);
    socket2.join(roomName);

    socket1.emit('room_joined', {room: roomName, username: usersInRoom[1].userName});
    socket2.emit('room_joined', {room: roomName, username: usersInRoom[0].userName});

    let listOfQuestions = JSON.stringify(generateEasyQuestions());
    await socket1.emit('questions', {questions: listOfQuestions});
    await socket2.emit('questions', {questions: listOfQuestions});
}

async function createNewAccount(googleid) {
    let d = new Date();
    let jv = {
        "userCoins": 20,
        "userTickets": 3,
        "googleId": googleid,
        "rewardTime" : d.getDate()-1,
        "AdsRemaining" : 5,
        "rewardAdTime" : d.getDate()-1
    };

    const docRef = await setDoc(doc(db, "Users", googleid), jv);
}

async function addPayoutInfo(type, amount, googleid){
    let jv = {
        "googleid" : googleid, 
        type : amount 
    };
    await addDoc(collection(db, "PayoutRequest"), jv);
    const tik = await getDoc(doc(db, "Users", googleid));
    let tikk = tik.data();
    let tic = tikk.userCoins;
    updateKarma(googleid, tic, amount);
    //await addDoc(collection(db, "Users", "History", userId), recordData);
}


async function checkforDocument(googleid) {
    const user = await getDoc(doc(db, "Users", googleid));
    let userInfo = user.data();
    let old_date = userInfo.rewardAdTime;
    let adsRem = userInfo.AdsRemaining;
    let userTick = userInfo.userTickets;
    let d = new Date();
    let new_date = d.getDate();
   
    if (new_date - old_date === 0) {
        if (adsRem === 0){
            console.log("no ads remaining for user");
        }
        else{
            updateAds(adsRem-1, userTick + 1, new_date, googleid);
        }
    }else{
        updateAds(4, userTick, new_date, googleid).then(()=>{
            console.log("ads initialized for today");
        })
    }
}

async function updateAds(ads, tick, day, userId){
    try { 
        const snapp = await doc(db, "Users", userId);
        await updateDoc(snapp, { AdsRemaining: ads , userTickets : tick, rewardAdTime : day});
    }
    catch(err){
        console.log(err.message);
    }
}



function generateEasyQuestions() {
    let questions = {};
    for (let sno = 1; sno <= 10; sno++) {

        var quetype = [0, 1];
        var que = quetype[Math.floor(Math.random() * 2)];

        if (que === 0) {

            let num1 = Math.floor((Math.random() * 100) + 1);
            let num2 = Math.floor((Math.random() * 100) + 1);
            var equation = num1.toString() + " + " + num2.toString() + " = ";
            let solution = num1 + num2;
            var question = {

                "firstValue": equation,
                "solution": solution
            };

            questions[sno.toString()] = question;
        } else {

            var sequence = ["+", "*"];
            var series = sequence[Math.floor(Math.random() * 2)];
            var startNum = Math.floor(Math.random() * 10) + 1;
            var multiplier = Math.floor(Math.random() * 5) + 2;

            if (series === "+") {
                var equation = startNum.toString() + ", " + (startNum + multiplier).toString() + ", " + (startNum + 2 * multiplier).toString() + " ...";
                let solution = startNum + 3 * multiplier;
                var question = {

                    "firstValue": equation,
                    "solution": solution
                };

                questions[sno.toString()] = question;
            } else {
                var equation = startNum.toString() + ", " + (startNum * multiplier).toString() + ", " + (startNum * multiplier * multiplier).toString() + " ...";
                let solution = startNum * multiplier * multiplier * multiplier;
                var question = {

                    "firstValue": equation,
                    "solution": solution
                };

                questions[sno.toString()] = question;
            }

        }

    }
    return questions;
}

function createUuid() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}


function generateScore2(room, user1, user2) {

    if (room !== "practice") {
        let userArray = Array.from(users.get(room));
        // <---------------------------------User 1 details -------------------------------------->//
        let user1score = user1.score;
        let user1googleId = user1.googleid;
        let user1ticket = userArray[0].userTickets;
        let user1coin = userArray[0].userCoin;
        let user1time = user1.time;
        // <---------------------------------User 2 details -------------------------------------->//
        let user2ticket = userArray[1].userTickets;
        let user2coin = userArray[1].userCoin;
        let user2score = user2.score;
        let user2googleId = user2.googleid;
        let user2time = user2.time;

        if (user1score > user2score) {
            updateWinner(user1googleId, user1coin, user1ticket, user2googleId, 5, 0).then(() => {
                updateRecord("Won", user1googleId);
                updateRecord("Lose", user2googleId);
            });
        } else if (user1score < user2score) {
            updateWinner(user2googleId, user2coin, user2ticket, user1googleId, 5, 0).then(() => {
                updateRecord("Won", user2googleId);
                updateRecord("Lose", user1googleId);
            });
        } else {
            if (user1time < user2time) {
                updateWinner(user1googleId, user1coin, user1ticket, user2googleId, 5, 0).then(() => {
                    updateRecord("Won", user1googleId);
                    updateRecord("Lose", user2googleId);
                });
            } else if (user1time > user2time) {
                updateWinner(user2googleId, user2coin, user2ticket, user1googleId, 5, 0).then(() => {
                    updateRecord("Won", user2googleId);
                    updateRecord("Lose", user1googleId);
                });
            } else {
                //updateWinner(user2googleId, user1coin, user1ticket, user1googleId, 2, 2).then(()=>{ console.log("Karma updated")});
            }
        }
    }

}


async function updateWinner(userId, currCoins, currTickets, userId2, amount1, amount2) {
    const snap = await doc(db, "Users", userId);
    const snap2 = await doc(db, "Users", userId2);

    await updateDoc(snap, {
        userCoins: currCoins + amount1,
        userTickets: currTickets - 1
    });

    await updateDoc(snap2, {
        userCoins: currCoins + amount2,
        userTickets: currTickets - 1
    });
}

async function updateKarma(userId, currKarma, amount) {
    
    try{

        const snapp = await doc(db, "Users", userId);
        await updateDoc(snapp, { userCoins: currKarma - amount});
        /*if (type === "inc"){
            const snapp = await doc(db, "Users", userId);
            await updateDoc(snapp, { userTickets: currCoins + 1 });
        }else{
            const snapp = await doc(db, "Users", userId);
            await updateDoc(snapp, { userTickets: currCoins - 1 });
        }*/
        
    }catch(err){
        console.log(err.message);
    }
    
}


async function updateTickets(userId, currTickets, type) {
    
    try{

        if (type === "inc"){
            const snapp = await doc(db, "Users", userId);
            await updateDoc(snapp, { userTickets: currTickets + 1 });
        }else{
            const snapp = await doc(db, "Users", userId);
            await updateDoc(snapp, { userTickets: currTickets - 1 });
        }
        
    }catch(err){
        console.log(err.message);
    }
    
}

async function sendDetailsToFirebase2(room, user1, user2, callback) {

    try {

        let jv = {
        "report1": user1.report,
        "score1": user1.score,
        "time1": user1.time,
        "googleId1": user1.googleid,
        "report2": user2.report,
        "score2": user2.score,
        "time2": user2.time,
        "googleId2": user2.googleid,
        };

        await setDoc(doc(db, "Result", room), jv);
        callback(room, user1, user2);


    }catch(err){
        console.log(err.message);
        console.log("sendtoFirebase error");
    }
    
}

async function updateRecord(gameStatus, userId) {

    try{
         var date = new Date();
        let recordData = {
            status: gameStatus,
            timestamp: date
        };

        //await setDoc(doc(db, "History", userId), jv);
        await addDoc(collection(db, "Users", "History", userId), recordData);
    }catch(err){
        //console.log(err.message);
        console.log(err.message);
        console.log("updateRecord error");
    }
   
};

