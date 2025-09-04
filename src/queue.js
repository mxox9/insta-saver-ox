const { Queue, Worker, QueueEvents } = require("bullmq");
const { REQUEST_STATUS } = require("./constants");
const ContentRequest = require("./models/ContentRequest");
const { log, waitFor } = require("./utils");
const { sendRequestedData } = require("./telegramActions");
const { scrapWithFastDl } = require("./apis");
const Metrics = require("./models/Metrics");

// Redis connection config (Upstash - correct way)
const redisConnection = {
    connection: {
        url: process.env.UPSTASH_REDIS_URL, // example: rediss://default:password@host.upstash.io:6379
        tls: {} // Upstash hamesha TLS/SSL use karta hai
    }
};

// Initialize BullMQ queue
const requestQueue = new Queue("contentRequestQueue", redisConnection);

// Function to clear the queue
const clearQueue = async () => {
    try {
        log("Clearing existing jobs in the queue...");
        await requestQueue.drain();
        await requestQueue.clean(0, "completed");
        await requestQueue.clean(0, "failed");
        log("Queue cleared.");
    } catch (error) {
        log("Error clearing queue:", error);
    }
};

// Worker
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

            if (!result.success) {
                const newRetryCount = retryCount + 1;

                if (newRetryCount <= 5) {
                    await ContentRequest.findByIdAndUpdate(id, {
                        $set: {
                            updatedAt: new Date(),
                            status: REQUEST_STATUS.PENDING,
                        },
                        $inc: { retryCount: 1 },
                    });
                } else {
                    await ContentRequest.findByIdAndDelete(id);
                    log(`Request document deleted: ${id}`);
                }

                log(`Job ${id} failed. Retry count: ${newRetryCount}`);
                log("Scraping failed");
            } else {
                await waitFor(500);
                await sendRequestedData({ ...result.data, ...job.data });
                await ContentRequest.findByIdAndDelete(id);
                log(`Request document deleted: ${id}`);

                await Metrics.findOneAndUpdate(
                    {},
                    {
                        $inc: {
                            totalRequests: 1,
                            [`mediaProcessed.${result.data?.mediaType}`]: 1,
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
                    $set: {
                        updatedAt: new Date(),
                        status: REQUEST_STATUS.PENDING,
                    },
                    $inc: { retryCount: 1 },
                });
            } else {
                await ContentRequest.findByIdAndDelete(id);
                log(`Request document deleted: ${id}`);
            }

            log(`Updated request ${id} for retry. Retry count: ${newRetryCount}`);
        }
    },
    { ...redisConnection, concurrency: 5 }
);

// Queue events
const queueEvents = new QueueEvents("contentRequestQueue", redisConnection);

queueEvents.on("completed", ({ jobId }) => {
    log(`Job ${jobId} completed successfully.`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
    log(`Job ${jobId} failed: ${failedReason}`);
});

// Pending requests fetcher
const fetchPendingRequests = async () => {
    try {
        const existingJobs = await requestQueue.getJobs([
            "waiting",
            "delayed",
            "active",
        ]);
        const existingJobIds = new Set(existingJobs.map((job) => job.data.id));

        const pendingRequests = await ContentRequest.find({
            status: REQUEST_STATUS.PENDING,
            retryCount: { $lt: 5 },
        }).sort({ requestedAt: 1 });

        log(`Fetched ${pendingRequests.length} pending requests from DB.`);
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

// Init Queue
const initQueue = async () => {
    try {
        await clearQueue();
        await fetchPendingRequests();
        log("Queue initialized with pending requests.");

        const changeStream = ContentRequest.watch();
        changeStream.on("change", async (change) => {
            if (change.operationType === "insert") {
                const newRequest = change.fullDocument;
                log("New request detected:", newRequest._id);

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
            log("Cleaned up old jobs from the queue.");
        }, 60000);
    } catch (error) {
        log("Error initializing queue:", error);
    }
};

module.exports = { initQueue };
