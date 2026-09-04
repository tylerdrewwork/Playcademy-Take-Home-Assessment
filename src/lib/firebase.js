import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
import { getPerformance } from "firebase/performance";

// Paste the config object from the Firebase console:
// Project settings -> General -> Your apps -> SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyCleJyU9rTMmd_5QWnKOYWBJyutv2Arymg",
  authDomain: "playcademy-assessment.firebaseapp.com",
  projectId: "playcademy-assessment",
  storageBucket: "playcademy-assessment.firebasestorage.app",
  messagingSenderId: "1027562773144",
  appId: "1:1027562773144:web:c40e61ae15b961a27dceed",
  databaseURL: "https://playcademy-assessment-default-rtdb.firebaseio.com/"
};

export const app = initializeApp(firebaseConfig);

// Anonymous Auth for players (see CLAUDE.md: Auth).
export const auth = getAuth(app);

// Realtime Database, scoped to live multiplayer game session state.
export const rtdb = getDatabase(app);

// Cloud Functions, the authoritative source of truth for multiplayer game state.
export const functions = getFunctions(app);

// Performance Monitoring: automatic page load/network traces, plus custom
// traces for lesson/multiplayer milestones (see CLAUDE.md: Crash/error monitoring).
export const perf = getPerformance(app);
