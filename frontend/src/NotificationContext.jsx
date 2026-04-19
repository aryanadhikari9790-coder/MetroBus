import React, { createContext, useContext, useState, useCallback } from "react";

const NotificationContext = createContext(null);

// Static reference for non-react modules (like api.js)
let notifyStatic = null;

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotification must be used within a NotificationProvider");
    return context;
};

// Externally accessible notifier
export const notifyGlobal = (msg, type = "info") => {
    if (notifyStatic) notifyStatic(msg, type);
    else console.warn("Notification system not initialized yet:", msg);
};

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);

    const notify = useCallback((message, type = "info") => {
        setNotification({ message, type, id: Date.now() });
    }, []);

    const close = useCallback(() => {
        setNotification(null);
    }, []);

    // Wire up the static reference
    notifyStatic = notify;

    return (
        <NotificationContext.Provider value={{ notification, notify, close }}>
            {children}
        </NotificationContext.Provider>
    );
};
