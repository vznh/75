// middleware/error-handler
export function handleError(error: any, context: string): void {
	console.error(`Error in ${context}:`, error);
}

export function handleAsyncError<T extends any[], R>(
	fn: (...args: T) => Promise<R>,
	context: string,
) {
	return async (...args: T): Promise<R | undefined> => {
		try {
			return await fn(...args);
		} catch (error) {
			handleError(error, context);
			return undefined;
		}
	};
}
