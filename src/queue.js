const { Queue, Worker, QueueEvents } = require("bullmq");
const { REQUEST_STATUS } = require("./constants");
const ContentRequest = require("./models/ContentRequest");
const { log, waitFor } = require("./utils");
const { sendRequestedData } = require("./telegramActions");
const { scrapWithFastDl } = require("./apis");
const Metrics = require("./models/Metrics");

const requestQueue = new Queue("contentRequestQueue", {
    connection: { host: "localhost", port: 6379 },
});

const clearQueue = async () => {
    try {
        log("Clearing existing jobs...");
        await requestQueue.drain();
        await requestQueue.clean(0, "completed");
        await requestQueue.clean(0, "failed");
    } catch (error) {
        log("Error clearing queue:", error);
    }
};

const requestWorker = new Worker(
    "contentRequestQueue",
    async (job) => {
        const { id, requestUrl, retryCount } = job.data;
        log(`Processing job: ${id}`);

        await ContentRequest.findByIdAndUpdate(id, {
            status: REQUEST_STATUS.PROCESSING,
            updatedAt: new Date(),
        });

        try {
            const result = await scrapWithFastDl(requestUrl);
            log("Scraper result:", result);

            if (!result.success) {
                const newRetryCount = retryCount + 1;
                if (newRetryCount <= 5) {
                    await ContentRequest.findByIdAndUpdate(id, {
                        $set: { updatedAt: new Date(), status: REQUEST_STATUS.PENDING },
                        $inc: { retryCount: 1 },
                    });
                } else {
                    await ContentRequest.findByIdAndDelete(id);
                }
                log(`Job ${id} failed. Retry: ${newRetryCount}`);
            } else {
                await waitFor(500);

                // ✅ Map scraper result properly
                const fixedData = {
                    ...job.data,
                    mediaUrl: result.data.videoUrl || result.data.imageUrl || result.data.mediaUrl,
                    mediaType: result.data.mediaType,
                    caption: result.data.caption || "",
                    mediaList: result.data.mediaList || [],
                };

                await sendRequestedData(fixedData);
                await ContentRequest.findByIdAndDelete(id);

                await Metrics.findOneAndUpdate(
                    {},
                    {
                        $inc: {
                            totalRequests: 1,
                            [`mediaProcessed.${fixedData.mediaType}`]: 1,
                        },
                        $set: { lastUpdated: new Date() },
                    },
                    { upsert: true, new: true }
                );
            }
        } catch (error) {
            log(`Error processing job ${id}:`, error);
            const newRetryCount = retryCount + 1;
            if (newRetryCount <= 5) {
                await ContentRequest.findByIdAndUpdate(id, {
                    $set: { updatedAt: new Date(), status: REQUEST_STATUS.PENDING },
                    $inc: { retryCount: 1 },
                });
            } else {
                await ContentRequest.findByIdAndDelete(id);
            }
        }
    },
    { connection: { host: "localhost", port: 6379 }, concurrency: 5 }
);

const queueEvents = new QueueEvents("contentRequestQueue", {
    connection: { host: "localhost", port: 6379 },
});
queueEvents.on("completed", ({ jobId }) => log(`Job ${jobId} completed.`));
queueEvents.on("failed", ({ jobId, failedReason }) =>
    log(`Job ${jobId} failed: ${failedReason}`)
);

const fetchPendingRequests = async () => {
    try {
        const existingJobs = await requestQueue.getJobs(["waiting", "delayed", "active"]);
        const existingJobIds = new Set(existingJobs.map((job) => job.data.id));

        const pendingRequests = await ContentRequest.find({
            status: REQUEST_STATUS.PENDING,
            retryCount: { $lt: 5 },
        }).sort({ requestedAt: 1 });

        log(`Fetched ${pendingRequests.length} pending requests`);
        for (const request of pendingRequests) {
            if (!existingJobIds.has(request._id.toString())) {
                await requestQueue.add("contentRequest", {
                    id: request._id.toString(),
                    messageId: request.messageId,
                    shortCode: request.shortCode,
                    requestUrl: request.requestUrl,
                    requestedBy: request.requestedBy,
                    retryCount: request.retryCount,
                    chatId: request.chatId,
                });
            }
        }
    } catch (error) {
        log("Error fetching pending requests:", error);
    }
};

const initQueue = async () => {
    try {
        await clearQueue();
        await fetchPendingRequests();
        log("Queue initialized.");

        const changeStream = ContentRequest.watch();
        changeStream.on("change", async (change) => {
            if (change.operationType === "insert") {
                const newRequest = change.fullDocument;
                await requestQueue.add("contentRequest", {
                    id: newRequest._id.toString(),
                    messageId: newRequest.messageId,
                    shortCode: newRequest.shortCode,
                    requestUrl: newRequest.requestUrl,
                    requestedBy: newRequest.requestedBy,
                    retryCount: newRequest.retryCount,
                    chatId: newRequest.chatId,
                });
            }
        });

        setInterval(fetchPendingRequests, 60000);
        setInterval(async () => {
            await requestQueue.clean(3600 * 1000, "completed");
            await requestQueue.clean(3600 * 1000, "failed");
        }, 60000);
    } catch (error) {
        log("Error initializing queue:", error);
    }
};

module.exports = { initQueue };
