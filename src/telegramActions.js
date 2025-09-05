const { Bot } = require("./config");
const {
    ACTION,
    ERROR_TYPE,
    LOG_TYPE,
} = require("./constants");
const { logMessage, logError } = require("./utils");

// Send typing action
const sendChatAction = async (context) => {
    const { chatId, requestUrl, requestedBy } = context;
    try {
        await Bot.sendChatAction(chatId, "typing");
    } catch (error) {
        const errorObj = {
            action: ACTION.SEND_CHAT_ACTION,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
            requestedBy,
            chatId,
            requestUrl,
        };
        logError({ ...errorObj, type: error?.response?.body?.error_code === 429 ? ERROR_TYPE.RATE_LIMIT : ERROR_TYPE.FAILED });
    }
};

// Delete messages
const deleteMessages = async (context) => {
    const { chatId, messagesToDelete, requestUrl, requestedBy } = context;
    messagesToDelete.forEach(async (messageId) => {
        try {
            await Bot.deleteMessage(chatId, messageId);
        } catch (error) {
            const errorObj = {
                action: ACTION.DELETE_MESSAGE,
                errorCode: error?.response?.body?.error_code,
                errorDescription: error?.response?.body?.description,
                requestedBy,
                chatId,
                requestUrl,
            };
            logError({ ...errorObj, type: error?.response?.body?.error_code === 429 ? ERROR_TYPE.RATE_LIMIT : ERROR_TYPE.FAILED });
        }
    });
};

// Send message
const sendMessage = async (context) => {
    const { chatId, message, parseMode = "HTML", disablePreview = false, requestedBy, requestUrl } = context;
    try {
        await Bot.sendMessage(chatId, message, {
            parse_mode: parseMode,
            disable_web_page_preview: disablePreview,
        });
    } catch (error) {
        logError({
            chatId,
            requestedBy,
            requestUrl,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_MESSAGE,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

// Send video
const sendVideo = async (context) => {
    const { chatId, videoUrl, requestedBy, requestUrl } = context;
    try {
        await Bot.sendVideo(chatId, videoUrl, {
            caption: "",
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
            requestedBy,
            requestUrl,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_VIDEO,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

// Send photo
const sendPhoto = async (context) => {
    const { chatId, photoUrl, caption = "", requestedBy, requestUrl, extra } = context;
    try {
        await Bot.sendPhoto(chatId, photoUrl, { caption, ...extra });
        logMessage({
            chatId,
            type: LOG_TYPE.PHOTO,
            message: "Photo sent successfully ✅",
        });
    } catch (error) {
        logError({
            chatId,
            requestedBy,
            requestUrl,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_PHOTO,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
        });
    }
};

// Send media group
const sendMediaGroup = async (context) => {
    const { chatId, media, requestedBy, requestUrl } = context;
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
            requestedBy,
            requestUrl,
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
