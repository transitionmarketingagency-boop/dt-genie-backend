export type EmbeddedChunk = {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: string;
    source: string;
    intent: string;
    purpose: string;
    createdAt: string;
  };
};
