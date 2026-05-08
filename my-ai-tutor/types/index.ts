export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface Thread {
  id: string;
  title: string;
  preview: string;
  subject: string;
  createdAt: Date;
  messages: Message[];
}
