// models/responses

export interface ServiceResponse {
	success: boolean;
	error?: { code?: number; message: string };
}
