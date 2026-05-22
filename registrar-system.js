// 🔥 CM QUEUEHUB - CENTRALIZED CLOUD QUEUE SYSTEM v7.0 (Priority Lane Integration)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA__k1o9aqvJdHHCpakUWFgS8nbm2iqB54",
  authDomain: "queuehub-29698.firebaseapp.com",
  databaseURL: "https://queuehub-29698-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  projectId: "queuehub-29698",
  storageBucket: "queuehub-29698.firebasestorage.app",
  messagingSenderId: "995891160219",
  appId: "1:995891160219:web:a58e790190810823ab523e",
  measurementId: "G-872CBRM5FQ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const queueRef = ref(db, "registrarQueueData");

class QueueHubSystem {
    constructor() {
        this.serviceTimePerPerson = 4;
        this.queue = {
            current: null,
            list: [],
            counter: 0,
            windows: { 1: null, 2: null, 3: null },
            stats: { totalToday: 0 },
            logsHistory: [],
            systemSettings: { isCutOffActive: false },
            windowsAvailability: { 1: true, 2: true, 3: true }
        };
    }

    listenToCloudUpdates(callback) {
        onValue(queueRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (!data.list) data.list = [];
                if (!data.windows) data.windows = { 1: null, 2: null, 3: null };
                if (!data.stats) data.stats = { totalToday: 0 };
                if (!data.systemSettings) data.systemSettings = { isCutOffActive: false };
                if (!data.windowsAvailability) data.windowsAvailability = { 1: true, 2: true, 3: true };
                
                if (data.logsHistory && !Array.isArray(data.logsHistory)) {
                    data.logsHistory = Object.values(data.logsHistory);
                } else if (!data.logsHistory) {
                    data.logsHistory = [];
                }

                this.queue = data;
            }
            if (callback) callback(this.queue);
        });
    }

    async saveQueueToCloud() {
        try {
            await set(queueRef, this.queue);
        } catch (error) {
            console.error("Cloud Write Synchronization Error:", error);
        }
    }

    async toggleWindowState(windowNumber) {
        this.queue.windowsAvailability = this.queue.windowsAvailability || { 1: true, 2: true, 3: true };
        this.queue.windowsAvailability[windowNumber] = !(this.queue.windowsAvailability[windowNumber] !== false);
        
        if (this.queue.windowsAvailability[windowNumber] === false && this.queue.windows[windowNumber]) {
            this.queue.windows[windowNumber] = null;
        }
        await this.saveQueueToCloud();
    }

    async toggleMasterCutoff() {
        this.queue.systemSettings = this.queue.systemSettings || { isCutOffActive: false };
        this.queue.systemSettings.isCutOffActive = !this.queue.systemSettings.isCutOffActive;
        await this.saveQueueToCloud();
    }

    async joinQueue(userType = "student", explicitName = null, explicitId = "N/A", explicitPurpose = null, uniqueSessionId = null, isPriority = false) {
        try {
            this.queue.systemSettings = this.queue.systemSettings || { isCutOffActive: false };
            if (this.queue.systemSettings.isCutOffActive) {
                throw new Error("Registration Cut-Off is currently active. New numbers cannot be generated.");
            }

            this.queue.counter = this.queue.counter || 0;
            this.queue.counter++;

            // ⚡ Prefix token separation logic based on lane state
            const prefix = isPriority ? "P-" : "R-";
            const queueNumber = `${prefix}${String(this.queue.counter).padStart(3, "0")}`;

            const studentName = explicitName || localStorage.getItem("studentName") || "Guest User";
            const selectedService = explicitPurpose || localStorage.getItem("selectedService") || "General Inquiry";

            let refinedId = explicitId ? explicitId.trim() : "N/A";
            if (userType.toLowerCase() === "visitor" || refinedId === "" || refinedId === "HYBRID_WEB_MODE") {
                refinedId = "N/A";
            }

            const newQueue = {
                id: Date.now(),
                sessionId: uniqueSessionId || "sess_" + Math.random().toString(36).substr(2, 9),
                number: queueNumber,
                role: isPriority ? `${userType.charAt(0).toUpperCase() + userType.slice(1)} (Priority)` : userType.charAt(0).toUpperCase() + userType.slice(1),
                purpose: selectedService,
                name: studentName,
                studentName: studentName, 
                studentId: refinedId,
                fcmToken: "N/A", 
                status: "Waiting",
                timeJoined: Date.now(),
                estimatedWait: 0,
                position: 1,
                userId: userType,
                isPriority: isPriority
            };

            if (!this.queue.list) this.queue.list = [];

            if (isPriority) {
                // ⚡ PRIORITY ALGORITHM: Finds the index of the first standard row and injects ahead of it
                let insertIndex = this.queue.list.findIndex(item => !item.isPriority);
                if (insertIndex === -1) {
                    this.queue.list.push(newQueue);
                } else {
                    this.queue.list.splice(insertIndex, 0, newQueue);
                }
            } else {
                this.queue.list.push(newQueue);
            }
            
            this.updateAllEstimatesInsideArray();
            await this.saveQueueToCloud();
            return newQueue;
        } catch (error) {
            console.error("Join Processing Fault:", error);
            throw error;
        }
    }

    updateAllEstimatesInsideArray() {
        const activeServing = Object.values(this.queue.windows).filter(w => w !== null).length;
        if (this.queue.list) {
            this.queue.list.forEach((item, index) => {
                const position = index + 1 + activeServing;
                item.position = position;
                item.estimatedWait = Math.max(1, position * this.serviceTimePerPerson);
            });
        }
    }

    async assignNextToWindow(windowNumber) {
        if (!this.queue.list || this.queue.list.length === 0) {
            throw new Error("No items inside processing stack.");
        }
        if (this.queue.windows[windowNumber]) {
            throw new Error("Target window busy.");
        }
        if (this.queue.windowsAvailability && this.queue.windowsAvailability[windowNumber] === false) {
            throw new Error("Counter window is currently disabled.");
        }

        const nextPerson = this.queue.list.shift();
        nextPerson.status = "Serving";
        nextPerson.startedAt = Date.now();
        nextPerson.windowAssigned = windowNumber;

        this.queue.windows[windowNumber] = nextPerson;
        this.updateAllEstimatesInsideArray();
        await this.saveQueueToCloud();

        return nextPerson;
    }

    async terminateService(windowNumber, resolutionStatus = "Completed") {
        const activeItem = this.queue.windows[windowNumber];
        if (!activeItem) return null;

        const durationInSeconds = Math.round((Date.now() - activeItem.startedAt) / 1000);
        let durationString = `${durationInSeconds}s`;
        if (durationInSeconds >= 60) {
            durationString = `${Math.floor(durationInSeconds / 60)}m ${durationInSeconds % 60}s`;
        }

        const logRecord = {
            date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
            number: activeItem.number,
            name: activeItem.studentName || activeItem.name || "Guest User",
            userType: activeItem.role || "Student",
            purpose: activeItem.purpose || "General Inquiry",
            window: windowNumber,
            timeTaken: durationString,
            status: resolutionStatus,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!this.queue.logsHistory || !Array.isArray(this.queue.logsHistory)) {
            this.queue.logsHistory = [];
        }
        
        this.queue.logsHistory.unshift(logRecord);

        if (resolutionStatus === "Completed") {
            this.queue.stats.totalToday = (this.queue.stats.totalToday || 0) + 1;
        }

        this.queue.windows[windowNumber] = null;
        this.updateAllEstimatesInsideArray();
        
        await this.saveQueueToCloud();
        return logRecord;
    }

    async leaveQueue(uniqueSessionId) {
        if (this.queue.list) {
            this.queue.list = this.queue.list.filter(q => q.sessionId !== uniqueSessionId);
        }
        for (let i = 1; i <= 3; i++) {
            if (this.queue.windows[i] && this.queue.windows[i].sessionId === uniqueSessionId) {
                this.queue.windows[i] = null;
            }
        }
        this.updateAllEstimatesInsideArray();
        await this.saveQueueToCloud();
    }
}

window.sysBackend = new QueueHubSystem();