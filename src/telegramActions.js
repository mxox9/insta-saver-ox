const { Bot } = require("./config");
const {
    ACTION,
    ERROR_TYPE,
    LOG_TYPE,
    MESSSAGE,
    MEDIA_TYPE,
} = require("./constants");
const { log, logMessage, logError } = require("./utils");

// Send typing action to indicate user activity
const sendChatAction = async (context) => {
    const { chatId, messageId, requestedBy, requestUrl, message } = context;
    try {
        await Bot.sendChatAction(chatId, "typing");
    } catch (error) {
        let errorObj = {
            action: ACTION.SEND_CHAT_ACTION,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
            requestedBy,
            chatId,
            requestUrl,
        };
        if (error?.response?.body?.error_code === 429) {
            logError({ ...errorObj, type: ERROR_TYPE.RATE_LIMIT });
        } else {
            logError({ ...errorObj, type: ERROR_TYPE.FAILED });
        }
    }
};

// Delete specified messages from chat
const deleteMessages = async (context) => {
    const { chatId, messagesToDelete, requestedBy, requestUrl } = context;
    messagesToDelete.forEach(async (messageId) => {
        try {
            await Bot.deleteMessage(chatId, messageId);
        } catch (error) {
            let errorObj = {
                action: ACTION.DELETE_MESSAGE,
                errorCode: error?.response?.body?.error_code,
                errorDescription: error?.response?.body?.description,
                requestedBy,
                chatId,
                requestUrl,
            };
            if (error?.response?.body?.error_code === 429) {
                logError({ ...errorObj, type: ERROR_TYPE.RATE_LIMIT });
            } else {
                logError({ ...errorObj, type: ERROR_TYPE.FAILED });
            }
        }
    });
};

// Send a message to a chat
const sendMessage = async (context) => {
    const { chatId, message, parseMode = "HTML", disablePreview = false } = context;
    try {
        await Bot.sendMessage(chatId, message, {
            parse_mode: parseMode,
            disable_web_page_preview: disablePreview,
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_MESSAGE,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

// Send a video without title/hashtags + inline button
const sendVideo = async (chatId, videoUrl) => {
    try {
        await Bot.sendVideo(chatId, videoUrl, {
            caption: "", // No title or hashtags
            reply_markup: {
                inline_keyboard: [
                    [{ text: "My Boss 🥷", url: "https://t.me/mixy_ox" }]
                ]
            }
        });
        logMessage({
            chatId,
            type: LOG_TYPE.VIDEO,
            message: "Video sent successfully ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_VIDEO,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

// Send a photo
const sendPhoto = async (chatId, photoUrl, caption = "") => {
    try {
        await Bot.sendPhoto(chatId, photoUrl, { caption });
        logMessage({
            chatId,
            type: LOG_TYPE.PHOTO,
            message: "Photo sent successfully ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_PHOTO,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

// Send media group (album)
const sendMediaGroup = async (chatId, media) => {
    try {
        await Bot.sendMediaGroup(chatId, media);
        logMessage({
            chatId,
            type: LOG_TYPE.GROUP,
            message: "Media group sent successfully ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_MEDIA_GROUP,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

module.exports = {
    sendChatAction,
    deleteMessages,
    sendMessage,
    sendVideo,
    sendPhoto,
    sendMediaGroup,
};
