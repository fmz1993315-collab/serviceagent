export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
};

export type FeedbackType = "thumb_up" | "thumb_down";

