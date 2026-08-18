import "scheduler-polyfill";

let currentSupportScheduler: boolean;

/** Whether the Scheduling API is supported. */
export const supportScheduler = () => {
    if (currentSupportScheduler == undefined) {
        currentSupportScheduler = typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function';
    }
    return currentSupportScheduler;
};

export const yieldToMain = async () => {
    if (supportScheduler()) {
        await scheduler.yield();
    } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
};
