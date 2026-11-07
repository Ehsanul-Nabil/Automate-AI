import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "automate-ai-8557a.firebaseapp.com",
  projectId: "automate-ai-8557a",
  storageBucket: "automate-ai-8557a.firebasestorage.app",
  messagingSenderId: "862532634673",
  appId: "1:862532634673:web:b438ddd863b2598f46ad10"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()