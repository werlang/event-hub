/**
 * Implements the `BackgroundTask` class for running recurring operations on the API process.
 *
 * This class accepts a cron-like rule string and a callback, and schedules the callback to run at the specified intervals.
 * It supports both standard cron expressions and human-friendly rules like "every sunday at 18:00".
 * In production, the callbacks will be executed as scheduled. In other environments, the scheduled times will be logged instead.
 * Human-friendly rules:
 * - "every sunday at 18:00" (or any weekday) for weekly tasks
 * - "every day at 18:00" for daily tasks
 * - "every 15 minutes" for minute-based intervals
 * - "every 2 hours" for hour-based intervals
 */

import { CronExpressionParser } from 'cron-parser';

const HUMAN_WEEKDAY_RULE = /^every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\s+at\s+(\d{1,2}):(\d{2})$/i;
const HUMAN_DAILY_RULE = /^every\s+day\s+at\s+(\d{1,2}):(\d{2})$/i;
const HUMAN_MINUTE_RULE = /^every\s+(\d+)\s+minutes?$/i;
const HUMAN_HOUR_RULE = /^every\s+(\d+)\s+hours?$/i;
const WEEKDAY_INDEX = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
};

/**
 * Normalizes the logger dependency used by one background task.
 */
function normalizeLogger(logger) {
    return {
        info: typeof logger?.info === 'function' ? logger.info.bind(logger) : () => {},
        warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : () => {},
        error: typeof logger?.error === 'function' ? logger.error.bind(logger) : () => {},
    };
}

/**
 * Normalizes the timer adapter used by one background task.
 */
function normalizeTimerAdapter(timerAdapter) {
    if (
        typeof timerAdapter?.setTimeout !== 'function'
        || typeof timerAdapter?.clearTimeout !== 'function'
    ) {
        throw new TypeError('BackgroundTask requires timer functions compatible with the global timer API.');
    }

    return {
        setTimeout: timerAdapter.setTimeout.bind(timerAdapter),
        clearTimeout: timerAdapter.clearTimeout.bind(timerAdapter),
    };
}

/**
 * Resolves the process-local time zone used for cron calculations.
 */
function resolveTimeZone(timeZone) {
    if (typeof timeZone === 'string' && timeZone.trim()) {
        return timeZone.trim();
    }

    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Validates the callback used by one background task.
 */
function normalizeCallback(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('Background task callback must be a function.');
    }

    return callback;
}

/**
 * Normalizes one current-time provider for deterministic scheduling and tests.
 */
function normalizeNowFactory(getNow) {
    if (getNow === undefined) {
        return () => new Date();
    }

    if (typeof getNow !== 'function') {
        throw new TypeError('Background task getNow must be a function when provided.');
    }

    return () => {
        const value = getNow();
        const now = value instanceof Date ? new Date(value.getTime()) : new Date(value);

        if (Number.isNaN(now.getTime())) {
            throw new TypeError('Background task getNow must return a valid date.');
        }

        return now;
    };
}

/**
 * Normalizes one task name used in logs.
 */
function normalizeName(name, callback, rule) {
    const normalizedName = String(name || callback.name || rule).trim();

    if (!normalizedName) {
        throw new TypeError('Background task name must resolve to a non-empty string.');
    }

    return normalizedName;
}

/**
 * Returns whether one rule string already looks like a cron expression.
 */
function looksLikeCronExpression(rule) {
    const fields = rule.split(/\s+/);

    return fields.length === 5 || fields.length === 6;
}

/**
 * Validates one hour-and-minute pair used by the human-friendly parser.
 */
function normalizeClockTime(hourText, minuteText) {
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new TypeError('Background task hour must be between 0 and 23.');
    }

    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
        throw new TypeError('Background task minute must be between 0 and 59.');
    }

    return { hour, minute };
}

/**
 * Converts one supported human-friendly scheduling rule into a cron expression.
 */
function buildCronExpressionFromHumanRule(rule) {
    const weeklyMatch = HUMAN_WEEKDAY_RULE.exec(rule);

    if (weeklyMatch) {
        const [, weekdayText, hourText, minuteText] = weeklyMatch;
        const { hour, minute } = normalizeClockTime(hourText, minuteText);
        const weekdayIndex = WEEKDAY_INDEX[weekdayText.toLowerCase()];

        return `${minute} ${hour} * * ${weekdayIndex}`;
    }

    const dailyMatch = HUMAN_DAILY_RULE.exec(rule);

    if (dailyMatch) {
        const [, hourText, minuteText] = dailyMatch;
        const { hour, minute } = normalizeClockTime(hourText, minuteText);

        return `${minute} ${hour} * * *`;
    }

    const minuteMatch = HUMAN_MINUTE_RULE.exec(rule);

    if (minuteMatch) {
        const step = Number(minuteMatch[1]);

        if (!Number.isInteger(step) || step <= 0 || step > 59) {
            throw new TypeError('Background task minute interval must be between 1 and 59.');
        }

        return `*/${step} * * * *`;
    }

    const hourMatch = HUMAN_HOUR_RULE.exec(rule);

    if (hourMatch) {
        const step = Number(hourMatch[1]);

        if (!Number.isInteger(step) || step <= 0 || step > 23) {
            throw new TypeError('Background task hour interval must be between 1 and 23.');
        }

        return `0 */${step} * * *`;
    }

    throw new TypeError('Background task rule must be a cron expression or a supported human-friendly rule like "every sunday at 18:00".');
}

/**
 * Resolves one rule string into a cron expression.
 */
function normalizeRule(rule) {
    const normalizedRule = String(rule || '').trim().replace(/\s+/g, ' ');

    if (!normalizedRule) {
        throw new TypeError('Background task rule must be a non-empty string.');
    }

    return normalizedRule;
}

/**
 * Builds one cron expression from the public rule string.
 */
function resolveCronExpression(rule) {
    if (looksLikeCronExpression(rule)) {
        return rule;
    }

    return buildCronExpressionFromHumanRule(rule);
}

/**
 * Converts one cron occurrence value into a native Date.
 */
function normalizeOccurrenceDate(occurrence) {
    const timestamp = typeof occurrence?.getTime === 'function'
        ? occurrence.getTime()
        : Number.NaN;

    if (Number.isFinite(timestamp)) {
        return new Date(timestamp);
    }

    const date = new Date(String(occurrence));

    if (Number.isNaN(date.getTime())) {
        throw new TypeError('Background task could not resolve the next scheduled occurrence.');
    }

    return date;
}

/**
 * Builds the next execution date for one cron expression.
 */
function buildNextExecutionDate(cronExpression, referenceDate, timeZone) {
    const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: referenceDate,
        tz: timeZone,
    });

    return normalizeOccurrenceDate(interval.next());
}

/**
 * Runs one recurring background task from a cron-like rule string.
 */
export class BackgroundTask {

    #name;
    #rule;
    #cronExpression;
    #callback;
    #environment;
    #logger;
    #timers;
    #timeZone;
    #getNow;
    #timeoutHandle = null;
    #started = false;
    #running = false;

    /**
     * Creates one background task instance from a public rule string and callback.
     */
    constructor(rule, callback, {
        environment = process.env.NODE_ENV,
        logger = console,
        timers = globalThis,
        timeZone,
        getNow,
        name,
    } = {}) {
        this.#rule = normalizeRule(rule);
        this.#callback = normalizeCallback(callback);
        this.#cronExpression = resolveCronExpression(this.#rule);
        this.#name = normalizeName(name, this.#callback, this.#rule);
        this.#environment = String(environment || 'development').trim() || 'development';
        this.#logger = normalizeLogger(logger);
        this.#timers = normalizeTimerAdapter(timers);
        this.#timeZone = resolveTimeZone(timeZone);
        this.#getNow = normalizeNowFactory(getNow);

        buildNextExecutionDate(this.#cronExpression, this.#getNow(), this.#timeZone);
    }

    /**
     * Starts the task and recalculates the next occurrence from the current clock.
     */
    start() {
        if (this.#started) {
            return this;
        }

        this.#started = true;
        this.#scheduleNext(this.#getNow());
        this.#logger.info(`[${new Date().toISOString()}] Started background task "${this.#name}" with rule "${this.#rule}".`);
        return this;
    }

    /**
     * Stops the task and clears the currently scheduled timeout.
     */
    stop() {
        if (this.#timeoutHandle !== null) {
            this.#timers.clearTimeout(this.#timeoutHandle);
            this.#timeoutHandle = null;
        }

        this.#started = false;
        return this;
    }

    /**
     * Indicates whether callbacks should run in the current environment.
     */
    #isProduction() {
        return this.#environment === 'production';
    }

    /**
     * Schedules the next occurrence from one reference date.
     */
    #scheduleNext(referenceDate) {
        if (!this.#started) {
            return;
        }

        const nextExecutionDate = buildNextExecutionDate(this.#cronExpression, referenceDate, this.#timeZone);
        const delayMs = Math.max(0, nextExecutionDate.getTime() - referenceDate.getTime());

        this.#timeoutHandle = this.#timers.setTimeout(() => {
            this.#timeoutHandle = null;
            this.#scheduleNext(new Date(nextExecutionDate.getTime() + 1000));
            void this.#run();
        }, delayMs);
    }

    /**
     * Executes the scheduled callback or logs the skipped run outside production.
     */
    async #run() {
        if (!this.#isProduction() && process.env.EMAIL_TESTING !== 'true') {
            this.#logger.info(`[${new Date().toISOString()}] Skipping background task "${this.#name}" for rule "${this.#rule}" because NODE_ENV is "${this.#environment}".`);
            return;
        }

        if (this.#running) {
            this.#logger.warn(`[${new Date().toISOString()}] Skipping overlapping background task "${this.#name}" because the previous run is still in progress.`);
            return;
        }

        this.#running = true;

        try {
            await this.#callback();
        } catch (error) {
            this.#logger.error(`[${new Date().toISOString()}] Background task "${this.#name}" failed.`, error);
        } finally {
            this.#running = false;
        }
    }
}