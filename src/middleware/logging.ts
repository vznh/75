// middleware/logging
export function logInfo(message: string, data?: any): void {
  console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : '');
}

export function logError(message: string, error?: any): void {
  console.error(`[ERROR] ${message}`, error);
}

export function logDebug(message: string, data?: any): void {
  console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data) : '');
}