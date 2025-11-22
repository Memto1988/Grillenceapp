import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBI3iotLqwEIyEaup6DVByUgv_DumjmRmo",
    authDomain: "grillence.firebaseapp.com",
    projectId: "grillence", 
    storageBucket: "grillence.firebasestorage.app",
    messagingSenderId: "367727129474",
    appId: "1:367727129474:web:949720858d7817a912159b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, firebaseConfig };