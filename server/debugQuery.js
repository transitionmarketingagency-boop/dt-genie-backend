// server/debugQuery.js
import runApp from "./app.js";

export async function debugQuery(message, sessionId = "debugSession") {
    const response = await runApp(async (app, httpServer) => {
        // assume `processMessage` is your internal bot function
        const result = await app.processMessage?.({ message, sessionId });
        if (!result) return { ok: false, error: "No response from bot" };

        // Log KB chunks matched
        console.log("🔹 KB chunks matched:", result.kbChunks?.map(c => c.id || c.slice(0,50)));

        // Log model used
        console.log("🔹 Model used:", result.model || process.env.GEMINI_MODEL);

        return result;
    });
    return response;
}

// usage:
debugQuery("tell me about your virtual home tour service");
