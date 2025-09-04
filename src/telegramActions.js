const { Bot } = require("./config");
const {
    ACTION,
    ERROR_TYPE,
    LOG_TYPE,
    MESSSAGE,
    MEDIA_TYPE,
} = require("./constants");
const { log, logMessage, logError } = require("./utils");

// Send typing action
const sendChatAction = async (context = {}) => {
    const {
        chatId,
        messageId,
        requestedBy = {},
        requestUrl,
        message,
    } = context;
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
        logError({
            ...errorObj,
            type:
                error?.response?.body?.error_code === 429
                    ? ERROR_TYPE.RATE_LIMIT
                    : ERROR_TYPE.FAILED,
        });
    }
};

// Delete messages
const deleteMessages = async (context = {}) => {
    const {
        chatId,
        messagesToDelete = [],
        requestedBy = {},
        requestUrl,
    } = context;
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
            logError({
                ...errorObj,
                type:
                    error?.response?.body?.error_code === 429
                        ? ERROR_TYPE.RATE_LIMIT
                        : ERROR_TYPE.FAILED,
            });
        }
    });
};

// Send a message
const sendMessage = async (context = {}) => {
    const {
        chatId,
        message,
        parseMode = "HTML",
        disablePreview = false,
        requestedBy = {},
    } = context;
    try {
        await Bot.sendMessage(chatId, message, {
            parse_mode: parseMode,
            disable_web_page_preview: disablePreview,
        });
        logMessage({
            chatId,
            type: LOG_TYPE.TEXT,
            message: "Message sent ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_MESSAGE,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
            requestedBy,
        });
    }
};

// Send video (with inline button, no caption)
const sendVideo = async (chatId, videoUrl, requestedBy = {}) => {
    try {
        await Bot.sendVideo(chatId, videoUrl, {
            caption: "",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "My Boss 🥷", url: "https://t.me/mixy_ox" }],
                ],
            },
        });
        logMessage({
            chatId,
            type: LOG_TYPE.VIDEO,
            message: "Video sent ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_VIDEO,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
            requestedBy,
        });
    }
};

// Send photo
const sendPhoto = async (
    chatId,
    photoUrl,
    caption = "",
    extra = {},
    requestedBy = {}
) => {
    try {
        await Bot.sendPhoto(chatId, photoUrl, {
            caption,
            ...extra,
        });
        logMessage({
            chatId,
            type: LOG_TYPE.PHOTO,
            message: "Photo sent ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_PHOTO,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
            requestedBy,
        });
    }
};

// Send media group
const sendMediaGroup = async (chatId, media, requestedBy = {}) => {
    try {
        await Bot.sendMediaGroup(chatId, media);
        logMessage({
            chatId,
            type: LOG_TYPE.GROUP,
            message: "Media group sent ✅",
        });
    } catch (error) {
        logError({
            chatId,
            type: ERROR_TYPE.FAILED,
            action: ACTION.SEND_MEDIA_GROUP,
            errorCode: error?.response?.body?.error_code,
            errorDescription: error?.response?.body?.description,
            requestedBy,
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
