import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Paste the config object from the Firebase console:
// Project settings -> General -> Your apps -> SDK setup and configuration
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export const app = initializeApp(firebaseConfig);

// Anonymous Auth for players (see CLAUDE.md: Auth).
export const auth = getAuth(app);

// Realtime Database, scoped to live multiplayer game session state.
export const rtdb = getDatabase(app);
