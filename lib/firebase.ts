// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyDQYVDs5kejxNezUbyFo-daHAhluJq5KnI",
  authDomain: "p2p2-lahacks.firebaseapp.com",
  projectId: "p2p2-lahacks",
  storageBucket: "p2p2-lahacks.firebasestorage.app",
  messagingSenderId: "266393284350",
  appId: "1:266393284350:web:784750705ecefd314e3faf",
  measurementId: "G-8LE21KEMK4"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);