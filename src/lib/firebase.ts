import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCVvtQkOXpZ2V-joJ68Q4kdO_Egu2-XgZk",
  authDomain: "fire-simulator-fe9e6.firebaseapp.com",
  projectId: "fire-simulator-fe9e6",
  storageBucket: "fire-simulator-fe9e6.firebasestorage.app",
  messagingSenderId: "793037453491",
  appId: "1:793037453491:web:ff93b723fc60b156c718c6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
