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
            addUsersToRoom().then(() => {
                usersInRoom = []
                console.log("users Added to the room")
            });
        }

    });

    socket.on("exitRoom", () => {
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
                userResult.delete(room);
                users.delete(room);
            });

        } else {
            if (userResult.has(room)) {
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
                    //userResult.delete(room);
                    console.log("firebase details sent");
                });

            } else {

                let jv = {
                    "googleid": google_id,
                    "time": timeForSubmission,
                    "score": score,
                    "report": reportString,
                };
                userResult.set(room, jv);
            }
        }


        /*let reportString = JSON.stringify(report);
        sendDetailsToFirebase(room, reportString, score, timeforsubmission, google_id, socket, generateScore)
            .then(()=>{
                
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


});

server.listen(port, () => {
    console.log('listening on *:', port);
});

//<-------------------------------------Functions are defined here--------------------------------------->


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
    let jv = {
        "userCoins": 20,
        "userTickets": 3,
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
                updateRecord("Won", user1googleid);
                updateRecord("Lose", user2googleid);
            });
        } else if (user1score < user2score) {
            updateWinner(user2googleId, user2coin, user2ticket, user1googleId, 5, 0).then(() => {
                updateRecord("Won", user2googleid);
                updateRecord("Lose", user1googleid);
            });
        } else {
            if (user1time < user2time) {
                updateWinner(user1googleId, user1coin, user1ticket, user2googleId, 5, 0).then(() => {
                    updateRecord("Won", user1googleid);
                    updateRecord("Lose", user2googleid);
                });
            } else if (user1time > user2time) {
                updateWinner(user2googleId, user2coin, user2ticket, user1googleId, 5, 0).then(() => {
                    updateRecord("Won", user2googleid);
                    updateRecord("Lose", user1googleid);
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

async function sendDetailsToFirebase2(room, user1, user2, callback) {

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

}

async function updateRecord(gameStatus, userId) {

    var date = new Date();
    let recordData = {
        status: gameStatus,
        timestamp: date
    };

    //await setDoc(doc(db, "History", userId), jv);
    await addDoc(doc(db, "History", userId), recordData);
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
    else { socket.emit("message", { msg : "waiting for other user" }); }

        
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



    */

