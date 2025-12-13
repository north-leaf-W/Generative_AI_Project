import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";

export interface AlibabaTongyiEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  modelName?: string;
}

export class AlibabaTongyiEmbeddings extends Embeddings {
  modelName = "text-embedding-v4";
  apiKey: string;

  constructor(fields?: AlibabaTongyiEmbeddingsParams) {
    super(fields ?? {});
    this.modelName = fields?.modelName ?? this.modelName;
    this.apiKey = fields?.apiKey ?? process.env.DASHSCOPE_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("Aliyun DashScope API key not found");
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    // Batch processing if needed, but for now simple loop or small batch
    // DashScope API limit: 25 texts per batch usually.
    const batchSize = 1; // Keeping it safe with 1 for now or optimize later.
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(text => this.embedQuery(text)));
      embeddings.push(...results);
    }
    
    return embeddings;
  }

  async embedQuery(document: string): Promise<number[]> {
    const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        input: {
          texts: [document]
        },
        parameters: {
          text_type: "query",
          dimensions: 1024
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aliyun Embedding API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.output && data.output.embeddings && data.output.embeddings.length > 0) {
      return data.output.embeddings[0].embedding;
    }

    throw new Error("Invalid response from Aliyun Embedding API");
  }
}
