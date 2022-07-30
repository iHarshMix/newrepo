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

const appversion = "2.1";
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
        console.log(`${usertype.username} connected`);
        let user = {
            "socket": socket,
            "id": socket.id,
            "userName": usertype.username,
            "userCoin": usertype.usercoins,
            "userTickets": usertype.usertickets,
        };

        usersInRoom.push(user);

        if (usersInRoom.length === 2) {
            addUsersToRoom().then(()=> {
                usersInRoom = []
                console.log("users Added to the room")
            });
        }

    });

    socket.on("exitRoom", ()=>{
        usersInRoom = []
    })

    socket.on('message_other', (msg, room) => {
        io.to(room).emit("message", msg);
    });

    socket.on("disconnecting", (reason) => {
        console.log(`reason: ${reason}`);
        let w = 0;
        for (let i in users.keys()) {
            //console.log(i);
            let userr = Array.from(users.get(i));
            if (socket.id === userr[0].id) {
                console.log(`user left with users name : ${userr[0].username}`);
                io.to(userr[1].id).emit('message', "other user disconnected");
                users.delete(i);
                w = 1;
                break;
            } else {
                console.log(`user left with users username : ${userr[1].username}`);
                io.to(userr[0].id).emit('message', "other user disconnected");
                users.delete(i);
                w = 1;
                break;
            }
        }

        if (w === 0) {
            usersInRoom = [];
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
        if (userResult.has(room)){
            console.log("after--------------------------------------")
            console.log(`room ${room}`);
            let old = userResult.get(room);
            //console.log(old.googleid);
            //console.log(old.time);
            
            let user1 = {
                "googleid" : old.googleid,
                "time" : old.time,
                "score" : old.score,
                "report" : old.report,
            };

            let user2 = {
                "googleid" : google_id,
                "time" : timeForSubmission,
                "score" : score,
                "report" : reportString,
            };


            setTimeout(()=>{
                old.socket.emit('userReport', {"user1" : user1, "user2": user2});
                socket.emit('userReport', {"user1" : user1, "user2": user2});
            }, 2000);
        
            //old.socket.e('userReport', {"user1" : JSON.stringify(user1), "user2": JSON.stringify(user2)});
            //userResult.delete(room);
                        //io.to(room).emit( {
           // console.log(old[0].googleid);
            //console.log(old[0].time);

        }else {
            //console.log(`room ${room}`);
            let jv = {
                "googleid" : google_id,
                "time" : timeForSubmission,
                "score" : score,
                "report" : reportString,
                "socket" : socket
            };
            userResult.set(room, jv);
            //console.log(userResult.get(room))
        }

        /*let reportString = JSON.stringify(report);
        sendDetailsToFirebase(room, reportString, score, timeforsubmission, google_id, socket, generateScore)
            .then(()=>{
                console.log("firebase details sent")
            });*/

    });

    socket.on('watchAds', (userInfo) => {
        let googleid = userInfo.googleid;
        let adstatus = userInfo.status;

        checkforDocument(googleid).then(() => {
            increaseTickets(googleid, adstatus);
        });
    });

    socket.on('payout', (info) => {
        let type = info.type;
        let amount = info.amount;
        let googleid = info.googleid;
    });

    socket.on('newaccount', (info) => {
        let googleid = info.googleid;
        createNewAccount(googleid);
    })

    socket.on('getQuestions', ()=> {
        let listOfQuestions = JSON.stringify(generateEasyQuestions());
        socket.emit('practiceQuestion', {questions: listOfQuestions});
    });

    socket.on('getReport', (info)=>{
        let reportJson = info.report1;
        let reportJson2 = info.report2;
        let time = info.time;
        let userScore = info.score;

        let score = 0;
        for (let i = 0; i < reportJson.length; i++) {
            if (reportJson[i].yourans === reportJson[i].correctans) {
                score++;
            }
        }

        let reportString2 = JSON.stringify(reportJson2);
        let reportString1 = JSON.stringify(reportJson);
        var js = {
            "report1" : reportString1,
            "report2" : reportString2,
            "score" : score
        };
        socket.emit("userResult", js);

    })

});

server.listen(port, () => {
    console.log('listening on *:', port);
});


//<-------------------------------------Functions are defined here--------------------------------------->
async function addUsersToRoom(){
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
    let jv = {
        "userCoins": 20,
        "userTickets": 4,
        "googleId": googleid
    };

    const docRef = await setDoc(doc(db, "Users", googleid), jv);
}

/*async function addPayoutInfo(type, amount, googleid){
    const docref = await getDoc(doc(db, ))
}*/

async function increaseTickets(googleid, adstatus) {
    const docc = await getDoc(doc(db, "WatchAds", googleid));
    let stu = docc.data();
    let adsRemain = stu.AdsRemaining;
    if (adsRemain === 0) {
        console.log("no ads AdsRemaining");
    } else {
        if (adstatus === "full") {
            op(googleid);
            decreaseAds(googleid, adsRemain);
        }
    }
};

async function op(googleid) {
    const tik = await getDoc(doc(db, "Users", googleid));
    let tikk = tik.data();
    let tic = tikk.userTickets;

    updateTickets(googleid, tic);
    console.log("tickets Added");
};

async function checkforDocument(googleid) {
    const adsRem = await getDoc(doc(db, "WatchAds", googleid));
    if (!adsRem.exists()) {
        let jj = {"AdsRemaining": 5};
        const setAds = await setDoc(doc(db, "WatchAds", googleid), jj);
    }
}

async function decreaseAds(googleid, adRem) {
    let jj = {"AdsRemaining": adRem - 1};
    const setAds = await setDoc(doc(db, "WatchAds", googleid), jj);
}

function generateEasyQuestions() {
    let questions = {};
    for (let sno = 1; sno <= 5; sno++) {

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

function generateScore(room, report, score, socket, google_id, timetaken) {

    if (userResult.has(room)) {
        let obj = {};
        obj["report"] = report;
        obj["score"] = score;
        obj["socketid"] = socket;
        obj["googleid"] = google_id;
        obj["timetaken"] = timetaken;
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
        let user1timetaken = userResultArray[0].timetaken;
        let user1score = userResultArray[0].score;
        let user2ticket = userArray[1].userTickets;
        let user2coin = userArray[1].userCoin;
        let user2googleid = userResultArray[1].googleid;
        let user2timetaken = userResultArray[1].timetaken;
        let user2score = userResultArray[1].score;


        if (user1score > user2score) {
            updateWinner(user1googleid, user1coin, user1ticket, user2googleid, 5, 0);
            updateRecord("Won", user1googleid);
            updateRecord("Lose", user2googleid);
        } else if (user1score < user2score) {
            updateWinner(user2googleid, user2coin, user2ticket, user1googleid, 5, 0);
            updateRecord("Lose", user1googleid);
            updateRecord("Won", user2googleid);
        } else {
            if (user1timetaken < user2timetaken) {
                updateWinner(user1googleid, user1coin, user1ticket, user2googleid, 5, 0);
                updateRecord("Won", user1googleid);
                updateRecord("Lose", user2googleid);
            } else if (user1timetaken < user2timetaken) {
                updateWinner(user2googleid, user2coin, user2ticket, user1googleid, 5, 0);
                updateRecord("Lose", user1googleid);
                updateRecord("Won", user2googleid);
            } else {
                console.log("both users draw");
                updateWinner(user2googleid, user2coin, user2ticket, user1googleid, 3, 3);
                updateRecord("Draw", user1googleid);
                updateRecord("Draw", user2googleid);
            }
        }

        userResult.delete(room);
        users.delete(room);

        console.log("--------------------Second end----------------------");
    } else {

        let obj = {};
        obj["report"] = report;
        obj["googleid"] = google_id;
        obj["score"] = score;
        obj["socketid"] = socket;
        obj["timetaken"] = timetaken;
        userResult.set(room, obj);


        //console.log(userResult);
        console.log("--------------------first end----------------------");
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

async function updateTickets(userId, currTickets) {
    const snapp = await doc(db, "Users", userId);

    await updateDoc(snapp, {
        userTickets: currTickets + 1
    });
}

async function sendDetailsToFirebase(room, report, score, timetaken, googleid, socket, callback) {

    let jv = {
        "report": report,
        "score": score,
        "time": timetaken,
        "googleId": googleid
    };

    //console.log(jv);
    const docRef = await addDoc(collection(db, "Tip", "result", room), jv);
    callback(room, report, score, socket, googleid, timetaken);

}

async function updateRecord(gameStatus, userId) {

    var date = new Date();
    let recordData = {
        status: gameStatus,
        timestamp: date
    };
    const docReff = await addDoc(collection(db, "Tip", "history", userId), recordData);
};


/*if (isEnoughUsers()){

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
    else { socket.emit("message", { msg : "waiting for other user" }); }*/

