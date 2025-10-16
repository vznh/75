// models/roles

export type GenericRole = {
	shorthand: string; // ex: "leetcode"
	description: string; // to send to LLM + for user ref
	color: string; // should be in 0-base hexa; ex. "0x251111"
	emoji: string; // to describe role
	type: "text" | "image" | "both";
};
