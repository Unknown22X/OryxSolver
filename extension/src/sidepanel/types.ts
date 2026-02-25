export type AiResponse = {
  answer: string;
  explanation: string;
};

export type SendPayload = {
  text: string;
  images: File[];
};
