// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
// import { getFirestore, type Firestore } from 'firebase/firestore'; // Uncomment if you need Firestore

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.warn(
    "Firebase configuration is missing or incomplete. " +
    "Please ensure all NEXT_PUBLIC_FIREBASE_ environment variables are set correctly in your .env.local file. " +
    "This may lead to authentication errors (e.g., auth/api-key-not-valid)."
  );
}


if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // Fallback or further error handling if necessary
    // For now, we'll let it throw if essential config is missing and causes `initializeApp` to fail.
    // The warning above should guide the user.
    throw error; 
  }
} else {
  app = getApps()[0];
}

const auth: Auth = getAuth(app);
// const db: Firestore = getFirestore(app); // Uncomment if you need Firestore

// Developer Note: To enable Google Sign-In:
// 1. Go to your Firebase project console.
// 2. Navigate to "Authentication" under the "Build" section.
// 3. Select the "Sign-in method" tab.
// 4. Find "Google" in the list of providers and enable it.
// 5. You may need to provide a project support email.
// For web applications, this is typically all that's needed. If you plan to build Android/iOS apps,
// you'll also need to configure SHA-1 fingerprints (for Android) or URL schemes (for iOS).

export { app, auth }; // Remove db if not used
