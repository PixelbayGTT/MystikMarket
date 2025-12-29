import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// REEMPLAZA CON LOS DATOS QUE COPIASTE DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyB3-ZfZpmJTbUvR9UeOFmn2F7oDnKz0WXQ",
  authDomain: "mystikmarket-1a296.firebaseapp.com",
  projectId: "mystikmarket-1a296",
  storageBucket: "mystikmarket-1a296.firebasestorage.app",
  messagingSenderId: "999199755166",
  appId: "1:999199755166:web:91351940643d6e72cd648f"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
