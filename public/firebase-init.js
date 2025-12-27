// Firebase initialization (Firestore & Auth - Compat SDK)
const firebaseConfig = {
  apiKey: "AIzaSyA8Lx0zTw6k7NYANa9aRHYK00BWDzXrNMo",
  authDomain: "report-issue-70467.firebaseapp.com",
  projectId: "report-issue-70467",
  storageBucket: "report-issue-70467.firebasestorage.app",
  messagingSenderId: "939672593066",
  appId: "1:939672593066:web:e310a392aba79cd51326d3",
  measurementId: "G-VBDW5R2ZPS"
};

// Initialize core Firebase services
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.firebaseApp = firebase;
window.db = db;

// Optional: enable Analytics if the compat script is loaded
if (typeof firebase.analytics === "function") {
  firebase.analytics();
}
