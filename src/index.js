require("dotenv").config();
const express = require("express");
const app = express();
const { Bot, connectDB, Browser } = require("./config");
const { initQueue } = require("./queue");
const { log } = require("./utils");
const ContentRequest = require("./models/ContentRequest");
const { sendMessage, sendPhoto, sendVideo } = require("./telegramActions");
const { isValidInstaUrl } = require("./utils/helper");
const { addOrUpdateUser } = require("./utils/addOrUpdateUser");

// Set the server to listen on port 6060
const PORT = process.env.PORT || 6060;

// -------------------- START COMMAND --------------------
Bot.onText(/^\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || "User";
    const userName = msg?.from?.username || "";

    const welcomeCaption = `👋 *Welcome, ${firstName}!*  
I'm an *Advanced Instagram Reels, Posts & Story Downloader Bot*.  
Just send me any Instagram link & I'll get it for you!`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "➕ Add Your Group", url: `https://t.me/${process.env.BOT_USERNAME}?startgroup=true` },
                    { text: "👨‍💻 My Owner", url: "https://t.me/mixy_ox" }
                ]
            ]
        },
        parse_mode: "Markdown"
    };

    // Send Photo with Caption and Buttons
    await sendPhoto({
        chatId,
        photoUrl: "https://i.ibb.co/XkLZZW9s/IMG-20250905-045429.jpg",
        caption: welcomeCaption,
        extra: buttons
    });
});

// -------------------- INSTAGRAM URL HANDLER --------------------
Bot.onText(/^https:\/\/www\.instagram\.com(.+)/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userMessage = msg.text;
    const userName = msg?.from?.username || "";
    const firstName = msg?.from?.first_name || "";

    const isURL =
        msg.entities &&
        msg.entities.length > 0 &&
        msg.entities[0].type === "url";

    if (isURL) {
        const requestUrl = userMessage;
        const urlResponse = isValidInstaUrl(requestUrl);
        log("urlResponse: ", urlResponse);

        if (!urlResponse.success || !urlResponse.shortCode) {
            log("Invalid or unsupported URL");
            return;
        }

        const newRequest = new ContentRequest({
            chatId,
            requestUrl,
            shortCode: urlResponse.shortCode,
            requestedBy: { userName, firstName },
            messageId: messageId,
        });

        try {
            await newRequest.save();
            await addOrUpdateUser(chatId, userName, firstName);
        } catch (error) {
            log("Error saving content request:", error);
        }
    }
});

// -------------------- SERVER SETUP --------------------
if (require.main === module) {
    app.listen(PORT, async () => {
        log(`Insta saver running at http://localhost:${PORT}`);
        try {
            await connectDB();
            await Browser.Open();
            await initQueue();
        } catch (error) {
            log("Error during startup:", error);
        }
    });
} else {
    module.exports = app;
}

app.get("/", (req, res) => {
    res.json({ message: "Welcome to Insta Saver Bot" });
});

app.get("/test", (req, res) => {
    res.json({ message: "Bot is Online!!" });
});

process.on("SIGINT", async () => {
    await Browser.Close();
    process.exit(0);
});
