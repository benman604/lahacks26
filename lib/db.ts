import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
