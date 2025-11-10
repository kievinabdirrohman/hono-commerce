/**
 * Async utility functions
 */

// Execute promises in parallel with error handling
export const promiseAllSettled = async <T>(
	promises: Promise<T>[],
): Promise<{
	successful: T[];
	failed: Array<{ error: Error; index: number }>;
}> => {
	const results = await Promise.allSettled(promises);

	const successful: T[] = [];
	const failed: Array<{ error: Error; index: number }> = [];

	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			successful.push(result.value);
		} else {
			failed.push({
				error:
					result.reason instanceof Error
						? result.reason
						: new Error(String(result.reason)),
				index,
			});
		}
	});

	return { successful, failed };
};

// Execute promises in batches (for rate limiting)
export const promiseBatch = async <T, R>(
	items: T[],
	batchSize: number,
	processor: (item: T) => Promise<R>,
): Promise<R[]> => {
	const results: R[] = [];

	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const batchResults = await Promise.all(batch.map(processor));
		results.push(...batchResults);
	}

	return results;
};

// Execute promises sequentially
export const promiseSequential = async <T, R>(
	items: T[],
	processor: (item: T) => Promise<R>,
): Promise<R[]> => {
	const results: R[] = [];

	for (const item of items) {
		const result = await processor(item);
		results.push(result);
	}

	return results;
};

// Timeout wrapper for promises
export const withTimeout = <T>(
	promise: Promise<T>,
	timeoutMs: number,
	errorMessage: string = "Operation timed out",
): Promise<T> => {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
		),
	]);
};

// Retry with exponential backoff
export const retryWithBackoff = async <T>(
	fn: () => Promise<T>,
	options: {
		maxAttempts?: number;
		initialDelay?: number;
		maxDelay?: number;
		backoffFactor?: number;
		onRetry?: (attempt: number, error: Error) => void;
	} = {},
): Promise<T> => {
	const {
		maxAttempts = 3,
		initialDelay = 1000,
		maxDelay = 10000,
		backoffFactor = 2,
		onRetry,
	} = options;

	let lastError: Error;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === maxAttempts) {
				throw lastError;
			}

			const delay = Math.min(
				initialDelay * backoffFactor ** (attempt - 1),
				maxDelay,
			);

			onRetry?.(attempt, lastError);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
};

// Async map with concurrency limit
export const asyncMap = async <T, R>(
	items: T[],
	mapper: (item: T, index: number) => Promise<R>,
	concurrency: number = 5,
): Promise<R[]> => {
	const results: R[] = new Array(items.length);
	let index = 0;

	const executeNext = async (): Promise<void> => {
		while (index < items.length) {
			const currentIndex = index++;
			results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
		}
	};

	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		() => executeNext(),
	);

	await Promise.all(workers);
	return results;
};

// Async filter
export const asyncFilter = async <T>(
	items: T[],
	predicate: (item: T, index: number) => Promise<boolean>,
): Promise<T[]> => {
	const results = await Promise.all(
		items.map(async (item, index) => ({
			item,
			passed: await predicate(item, index),
		})),
	);

	return results.filter((result) => result.passed).map((result) => result.item);
};

// Async reduce
export const asyncReduce = async <T, R>(
	items: T[],
	reducer: (accumulator: R, item: T, index: number) => Promise<R>,
	initialValue: R,
): Promise<R> => {
	let accumulator = initialValue;

	for (let i = 0; i < items.length; i++) {
		accumulator = await reducer(accumulator, items[i]!, i);
	}

	return accumulator;
};
