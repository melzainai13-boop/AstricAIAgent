
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { SYSTEM_PROMPT_TEMPLATE, PDF_OCR_CONTENT } from "../constants";

export const submitOrderFunctionDeclaration: FunctionDeclaration = {
  name: 'submit_customer_order',
  parameters: {
    type: Type.OBJECT,
    description: 'وظيفة مخصصة لإرسال طلبات العملاء (الاسم، الهاتف، تفاصيل الطلب، والعنوان) إلى إيميل الإدارة عبر Webhook بمجرد اكتمال البيانات.',
    properties: {
      customer_name: {
        type: Type.STRING,
        description: 'اسم العميل',
      },
      phone_number: {
        type: Type.STRING,
        description: 'رقم هاتف العميل',
      },
      order_details: {
        type: Type.STRING,
        description: 'تفاصيل النظام أو الخدمة المطلوبة',
      },
      address: {
        type: Type.STRING,
        description: 'عنوان العميل (اختياري)',
      },
    },
    required: ['customer_name', 'phone_number', 'order_details'],
  },
};

export class GeminiService {
  private modelName = 'gemini-3-flash-preview';

  constructor() {}

  /**
   * Safe helper to extract text from response parts without triggering the SDK warning
   * when function calls are present.
   */
  static getResponseText(response: GenerateContentResponse): string {
    const parts = response.candidates?.[0]?.content?.parts || [];
    let text = "";
    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
    }
    return text.trim();
  }

  async generateResponse(message: string, chatHistory: {role: string, parts: {text: string}[]}[], adminInstructions: string = "") {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = SYSTEM_PROMPT_TEMPLATE(PDF_OCR_CONTENT, adminInstructions);

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [
          ...chatHistory,
          { role: 'user', parts: [{ text: message }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
          topP: 0.95,
          tools: [{ functionDeclarations: [submitOrderFunctionDeclaration] }],
        },
      });

      return response;
    } catch (error: any) {
      // Don't log full error to console if it's a quota issue to keep logs clean
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Gemini API: Quota limit reached (429).");
      } else {
        console.error("Gemini API Error:", error);
      }
      throw error;
    }
  }

  async extractCustomerDetails(text: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    Analyze the following conversation and extract customer details into a JSON object.
    Fields: "name" (string), "phone" (string), "address" (string), "activityType" (string), "requestedService" (string).
    Only include fields that were explicitly mentioned. Return ONLY valid JSON.
    Conversation:
    "${text}"
    `;
    
    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });
      const responseText = GeminiService.getResponseText(response);
      return JSON.parse(responseText || "{}");
    } catch (e: any) {
      // Gracefully handle rate limits for background tasks without noise
      if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
        return null; 
      }
      console.error("Extraction Error:", e);
      return {};
    }
  }
}
