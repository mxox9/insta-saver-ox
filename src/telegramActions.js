const { Bot } = require("./config");
const { log } = require("./utils");

// ✅ Text Message भेजने वाला
const sendMessage = async ({ chatId, message, requestedBy, requestUrl }) => {
    try {
        await Bot.sendMessage(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔥 My Boss 🥷", url: "https://t.me/mixy_ox" },
                        { text: "🔗 Source", url: requestUrl }
                    ]
                ]
            }
        });
        log(`Message sent to ${requestedBy?.userName || chatId}`);
    } catch (error) {
        log("sendMessage Failed 😢: ", error.response?.body || error.message);
    }
};

// ✅ Photo भेजने वाला
const sendPhoto = async ({ chatId, photoUrl, caption, requestedBy, requestUrl }) => {
    try {
        await Bot.sendPhoto(chatId, photoUrl, {
            caption,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔥 My Boss 🥷", url: "https://t.me/mixy_ox" },
                        { text: "🔗 Source", url: requestUrl }
                    ]
                ]
            }
        });
        log(`Photo sent to ${requestedBy?.userName || chatId}`);
    } catch (error) {
        log("sendPhoto Failed 😢: ", error.response?.body || error.message);
    }
};

// ✅ Video भेजने वाला
const sendVideo = async ({ chatId, videoUrl, caption, requestedBy, requestUrl }) => {
    try {
        await Bot.sendVideo(chatId, videoUrl, {
            caption,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔥 My Boss 🥷", url: "https://t.me/mixy_ox" },
                        { text: "🔗 Source", url: requestUrl }
                    ]
                ]
            }
        });
        log(`Video sent to ${requestedBy?.userName || chatId}`);
    } catch (error) {
        log("sendVideo Failed 😢: ", error.response?.body || error.message);
    }
};

// ✅ Media Group (Carousel Posts) भेजने वाला
const sendMediaGroup = async ({ chatId, media, requestedBy, requestUrl }) => {
    try {
        // media array में captions repeat नहीं करेंगे वरना error आ सकता है
        if (media.length > 0) {
            media[0].caption = media[0].caption || "";
            media[0].parse_mode = "Markdown";
        }

        await Bot.sendMediaGroup(chatId, media);
        log(`MediaGroup sent to ${requestedBy?.userName || chatId}`);

        // Extra buttons बाद में भेज देंगे
        await Bot.sendMessage(chatId, "👇 Downloaded from Source", {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔥 My Boss 🥷", url: "https://t.me/mixy_ox" },
                        { text: "🔗 Source", url: requestUrl }
                    ]
                ]
            }
        });
    } catch (error) {
        log("sendMediaGroup Failed 😢: ", error.response?.body || error.message);
    }
};

// ✅ FIXED sendRequestedData
const sendRequestedData = async (context) => {
    const { chatId, mediaType, mediaUrl, displayUrl, caption = "" } = context;

    // अगर Video है
    if (mediaType === "video") {
        return sendVideo({
            chatId,
            videoUrl: mediaUrl,
            caption,
            requestedBy: context.requestedBy,
            requestUrl: context.requestUrl
        });
    }

    // अगर Photo है
    if (mediaType === "image") {
        return sendPhoto({
            chatId,
            photoUrl: displayUrl || mediaUrl,
            caption,
            requestedBy: context.requestedBy,
            requestUrl: context.requestUrl
        });
    }

    // अगर Multiple Media (carousel post) है
    if (mediaType === "media_group" && context.mediaList) {
        const media = context.mediaList.map((item) => {
            if (item.mediaType === "video") {
                return { type: "video", media: item.mediaUrl, caption: caption };
            } else {
                return { type: "photo", media: item.displayUrl, caption: caption };
            }
        });
        return sendMediaGroup({
            chatId,
            media,
            requestedBy: context.requestedBy,
            requestUrl: context.requestUrl
        });
    }

    // ❌ fallback (कुछ भी media नहीं मिला तो text भेजेगा)
    return sendMessage({
        chatId,
        message: caption || "❌ मीडिया डाउनलोड नहीं हो पाया।",
        requestedBy: context.requestedBy,
        requestUrl: context.requestUrl
    });
};

module.exports = {
    sendMessage,
    sendPhoto,
    sendVideo,
    sendMediaGroup,
    sendRequestedData
};
