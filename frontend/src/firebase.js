// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCAXhE00hbtO3FLyhLGaA5KAXVar4IBKuw",
  authDomain: "grubify-9cf13.firebaseapp.com",
  projectId: "grubify-9cf13",
  storageBucket: "grubify-9cf13.firebasestorage.app",
  messagingSenderId: "718557593634",
  appId: "1:718557593634:web:34742c30640f04352fca7b",
  measurementId: "G-7BGL3FJT08"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);