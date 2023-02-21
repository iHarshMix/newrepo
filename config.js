import { initializeApp } from "firebase/app";
import { getFirestore, setDoc, doc, getDoc, updateDoc} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDFW0W_yhlyKusYRW8xwNtIZqhiJxQZVp8",
  authDomain: "robo-mathque.firebaseapp.com",
  projectId: "robo-mathque",
  storageBucket: "robo-mathque.appspot.com",
  messagingSenderId: "869425345296",
  appId: "1:869425345296:web:9ac3b6e1349c2732bf6b95",
  measurementId: "G-EE2VXEQXHM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


export async function create_user(id){
	const docSnap = await getDoc(doc(db, "Users", id));
  if (docSnap.exists()){
    return docSnap.data();
  }else{
    var user = { "googleId" : id, "userCoin" : 120, "userName" :"bobo", "userTickets" : 6 };
    newUser(id, user);
    return user;
  }
	
}

async function newUser(id, data){
  await setDoc(doc(db, "Users", id), data);
}

export async function user_game_win(id, tickets, coins){
  const ref = doc(db, "Users", "30fmi");
  await updateDoc(ref, {
    "userCoin" : coins + 5,
    "userTickets" : tickets - 1
  }); 
}


export async function user_game_lost(id, tickets){
  const ref = doc(db, "Users", "30fmi");
  await updateDoc(ref, {
    "userTickets" : tickets - 1
  });

}

export async function user_game_exited(id, coins){
  const ref = doc(db, "Users", "30fmi");
  await updateDoc(ref, {
    "userCoin" : coins - 10,
  });
   
}