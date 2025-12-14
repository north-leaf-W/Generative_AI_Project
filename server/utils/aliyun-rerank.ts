
export interface RerankResult {
  index: number;
  relevance_score: number;
  document: {
    text: string;
  };
}

export class AlibabaTongyiRerank {
  private apiKey: string;
  private modelName: string = "gte-rerank";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DASHSCOPE_API_KEY || "";
    // 如果环境变量指定了 Rerank 模型，则使用之，否则默认 gte-rerank
    // 注意：gte-rerank 是 v1，gte-rerank-v2 效果可能更好但可能需要确认权限
    if (process.env.DASHSCOPE_RERANK_MODEL) {
      this.modelName = process.env.DASHSCOPE_RERANK_MODEL;
    }
    if (!this.apiKey) {
      throw new Error("Aliyun DashScope API key not found");
    }
  }

  async rerank(query: string, documents: string[], topN: number = 5): Promise<{ index: number; score: number }[]> {
    // 阿里云 Rerank API 限制：一次最多 100 个文档 (gte-rerank)
    // 我们这里假设传入的 documents 不会超过这个限制 (通常是 Top 20)
    
    try {
      const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          input: {
            query: query,
            documents: documents
          },
          parameters: {
            return_documents: false,
            top_n: topN
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Aliyun Rerank API Error: ${response.status} - ${errorText}`);
        // Fallback: 如果 Rerank 失败，返回原始顺序（假设原始顺序就是 0, 1, 2...）
        return documents.map((_, idx) => ({ index: idx, score: 0 })).slice(0, topN);
      }

      const data = await response.json();
      
      if (data.output && data.output.results) {
        return data.output.results.map((item: any) => ({
          index: item.index,
          score: item.relevance_score
        }));
      }

      throw new Error("Invalid response from Aliyun Rerank API");
    } catch (error) {
      console.error("Rerank process failed:", error);
      // Fallback
      return documents.map((_, idx) => ({ index: idx, score: 0 })).slice(0, topN);
    }
  }
}
