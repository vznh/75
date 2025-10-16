// services/zai-service.ts

interface ServiceResponse {
	success: boolean;
	error?: string;
}

interface ZAIInterface {
	verifyImage(
		imageUrl: string,
		goalDefinition: string,
		userContext?: string,
	): Promise<ServiceResponse>;
	verifyText(
		entryText: string,
		goalDefinition: string,
		userContext?: string,
	): Promise<ServiceResponse>;
	generatePrompt(
		goalDefinition: string,
		mediaType: "image" | "text",
	): Promise<ServiceResponse>;
	checkConfidence(score: number, threshold: number): Promise<ServiceResponse>;
}

class ZAIService implements ZAIInterface {}

const zaiService = new ZAIService();

export { zaiService };
