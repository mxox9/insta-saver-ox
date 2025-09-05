require("dotenv").config();
const express = require("express");
const app = express();
const { Bot, connectDB, Browser } = require("./config");
const { initQueue } = require("./queue");
const { log } = require("./utils");
const ContentRequest = require("./models/ContentRequest");
const { MESSSAGE } = require("./constants");
const { sendMessage, sendPhoto } = require("./telegramActions");
const { isValidInstaUrl } = require("./utils/helper");
const { addOrUpdateUser } = require("./utils/addOrUpdateUser");

const PORT = process.env.PORT || 6060;

// ✅ Start Command Handler
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

    await sendPhoto({
        chatId,
        photoUrl: "https://i.ibb.co/XkLZZW9s/IMG-20250905-045429.jpg",
        caption: welcomeCaption,
        extra: buttons,
        requestedBy: { userName, firstName }
    });
});

// ✅ Instagram Link Handler
Bot.onText(/^https:\/\/www\.instagram\.com(.+)/, async (msg) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userMessage = msg.text;
    const userName = msg?.from?.username || "";
    const firstName = msg?.from?.first_name || "";

    let isURL =
        msg.entities &&
        msg.entities.length > 0 &&
        msg.entities[0].type === "url";

    if (isURL) {
        let requestUrl = userMessage;
        let urlResponse = isValidInstaUrl(requestUrl);
        log("urlResponse: ", urlResponse);

        if (!urlResponse.success || !urlResponse.shortCode) {
            log("return from here as shortCode not found");
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

// ✅ Server Start
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

// ✅ Routes
app.get("/", (req, res) => {
    res.json({ message: "Welcome to Insta Saver Bot" });
});

app.get("/test", (req, res) => {
    res.json({ message: "Bot is Online!!" });
});

// ✅ Graceful Shutdown
process.on("SIGINT", async () => {
    await Browser.Close();
    process.exit(0);
});
