import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createDashScopeModel } from '../services/langchain.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const router = express.Router();

// 优化 Prompt 接口
router.post('/optimize-prompt', authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Description is required' 
      });
    }

    const model = createDashScopeModel();
    
    const response = await model.invoke([
      new SystemMessage(`
        You are an expert at translating and optimizing prompts for AI image generation.
        Your task is to translate the user's description (which may be in Chinese) into a concise English prompt.
        
        Rules:
        1. Translate the core meaning accurately to English.
        2. Keep it simple and direct. Do NOT add style keywords like "minimalist", "3d", "icon", "clay style" unless the user explicitly asked for them.
        3. Output ONLY the final English prompt string.
        4. If the description is already English, just return it as is (or slightly corrected).
      `),
      new HumanMessage(description)
    ]);

    const optimizedPrompt = response.content.toString();

    res.json({ 
      success: true, 
      data: { prompt: optimizedPrompt } 
    });

  } catch (error: any) {
    console.error('Optimize prompt error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
