import { initializeApp } from "firebase/app"

const firebaseConfig = {
    apiKey: "AIzaSyD44JohsvDlWQ6xIo0STfbZw2xCOfynn3Y",
    authDomain: "drawing-board-8fa89.firebaseapp.com",
    projectId: "drawing-board-8fa89",
    storageBucket: "drawing-board-8fa89.appspot.com",
    messagingSenderId: "464305925231",
    appId: "1:464305925231:web:0bc7be41eb58e34b56719a",
    measurementId: "G-2LC5Q2FEVX"
  };

const firebaseApp = initializeApp(firebaseConfig);
export default firebaseApp;
