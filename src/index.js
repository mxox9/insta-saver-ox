require("dotenv").config();
const { Bot } = require("./config");
const { sendChatAction } = require("./telegramActions");
const { saveRequestToDB, getPendingRequests } = require("./db");
const { downloadInstagramMedia } = require("./instagram");
const { isValidInstagramUrl } = require("./utils");

console.log("🤖 Bot is starting...");

// Bot username from env (needed for Add to Group button)
const BOT_USERNAME = process.env.BOT_USERNAME || "YourBotUsername";

// Start Command
const START_PHOTO = "https://i.ibb.co/XkLZZW9s/IMG-20250905-045429.jpg";

Bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || "User";

    const welcomeText = `👋 <b>Welcome, ${firstName}!</b>\n\n` +
        `🤖 I'm an <b>Advanced Instagram Reels, Post & Story Downloader Bot</b>.\n\n` +
        `✨ Just send me an Instagram link, and I'll fetch your content instantly!`;

    try {
        await sendChatAction({ chatId });

        await Bot.sendPhoto(chatId, START_PHOTO, {
            caption: welcomeText,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "➕ Add Your Group",
                            url: `https://t.me/${BOT_USERNAME}?startgroup=true`
                        }
                    ],
                    [
                        {
                            text: "My Owner 👨‍💻",
                            url: "https://t.me/mixy_ox"
                        }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error("Error sending start message:", error);
    }
});

// Handle Instagram URLs
Bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands
    if (!text || text.startsWith("/")) return;

    if (!isValidInstagramUrl(text)) {
        return Bot.sendMessage(chatId, "⚠️ Please send a valid Instagram link.");
    }

    try {
        await sendChatAction({ chatId });

        // Save request to DB
        await saveRequestToDB({
            chatId,
            username: msg.from.username,
            url: text
        });

        // Download Instagram media
        const mediaUrls = await downloadInstagramMedia(text);

        if (!mediaUrls || mediaUrls.length === 0) {
            return Bot.sendMessage(chatId, "❌ Failed to fetch media. Try again later.");
        }

        // Send all media (video/photo)
        for (const url of mediaUrls) {
            if (url.includes(".mp4")) {
                await Bot.sendVideo(chatId, url, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "My Boss 🥷", url: "https://t.me/mixy_ox" }
                            ]
                        ]
                    }
                });
            } else {
                await Bot.sendPhoto(chatId, url);
            }
        }
    } catch (error) {
        console.error("Error handling Instagram URL:", error);
        Bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
    }
});

// Process pending requests from DB periodically
(async function processPending() {
    try {
        const pending = await getPendingRequests();
        console.log(`[${new Date().toISOString()}] Fetched ${pending.length} pending requests from DB.`);
    } catch (err) {
        console.error("Error fetching pending requests:", err);
    } finally {
        setTimeout(processPending, 60000); // Run every 60s
    }
})();
