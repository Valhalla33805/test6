// ============================================================================
// 📁 FILE NAME: firebase-messaging-sw.js
// 📍 LOCATION: Must be saved directly inside your main root folder.
// ============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 🔌 Linked securely to your personal project account configurations
firebase.initializeApp({
    apiKey: "AIzaSyA__k1o9aqvJdHHCpakUWFgS8nbm2iqB54",
    authDomain: "queuehub-29698.firebaseapp.com",
    databaseURL: "https://queuehub-29698-default-rtdb.asia-southeast1.firebasedatabase.app/", 
    projectId: "queuehub-29698",
    storageBucket: "queuehub-29698.firebasestorage.app",
    messagingSenderId: "995891160219",
    appId: "1:995891160219:web:a58e790190810823ab523e"
});

const messaging = firebase.messaging();

// Catches network update payloads when tab state is hidden or asleep
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification.title || "🎫 CM QueueHub Alert";
    const notificationOptions = {
        body: payload.notification.body || "Your turn is approaching quickly! Please head back to the ACEH lobby right now.",
        icon: 'background2.jpg',  
        badge: 'background2.jpg',
        vibrate: [250, 100, 250],
        tag: 'queue-position-alert',
        requireInteraction: true     
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});