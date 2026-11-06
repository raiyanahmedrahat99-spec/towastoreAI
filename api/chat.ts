import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// Dedicated API Key for Towa Support AI
const EFFECTIVE_API_KEY = process.env.GEMINI_API_KEY || '';

interface ProductItem {
  handle: string;
  sku: string;
  name: string;
  category: string;
  price: string;
  inStock: string;
}

// Load and cache product catalog
let cachedCatalogSummary = '';
const productsList: ProductItem[] = [];

function loadCatalog() {
  if (cachedCatalogSummary) return cachedCatalogSummary;

  try {
    const csvPath = path.join(
      process.cwd(),
      'public/assets/aistudio/EXCEL_DATA_E-COMM_-_export_items_031cef76.csv'
    );
    if (fs.existsSync(csvPath)) {
      const csvRaw = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvRaw.split('\n').filter((l) => l.trim().length > 0);
      lines.slice(1).forEach((line) => {
        const parts = line.split(',');
        const handle = parts[0]?.trim() || '';
        const sku = parts[1]?.trim() || '';
        const name = parts[2]?.trim() || '';
        const category = parts[3]?.trim() || '';
        const price = parts[9]?.trim() || '0';
        const inStock = parts[10]?.trim() || '0';
        if (name) {
          productsList.push({ handle, sku, name, category, price, inStock });
        }
      });
      const linesFormatted = productsList.map(
        (p) => `• ${p.name} [ID: ${p.handle}] [Category: ${p.category}] - ৳${p.price} (In Stock: ${p.inStock})`
      );
      cachedCatalogSummary = `TOWA PRODUCT CATALOG (${productsList.length} live items):\n` + linesFormatted.join('\n');
    }
  } catch (err) {
    console.error('Failed reading catalog CSV:', err);
  }
  return cachedCatalogSummary;
}

const ai = new GoogleGenAI({
  apiKey: EFFECTIVE_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `You are "Towa Support AI", an exceptionally warm, polite, articulate, and human customer service professional for "Towa" (towastore.shop) - Bangladesh's trusted supermarket and grocery shop.

HUMAN CONVERSATIONAL TONE (STRICT):
- Speak in a natural, polite, respectful, and genuinely helpful human tone ("একদম মানুষের মতো মার্জিত, ভদ্র ও প্রফেশনাল ভাষায়").
- Never sound robotic, formulaic, or repetitive. Speak with emotional intelligence, courtesy, and warmth.
- When responding in Bengali, use respectful, polished phrasing ("আপনি", "ধন্যবাদ", "অবশ্যই", "সহায়তা করতে পেরে আনন্দিত").
- When responding in English, use refined, courteous executive phrasing ("Certainly", "I'd be glad to assist", "We truly appreciate you asking").
- STRICT CONSTRAINT: NEVER begin your messages with generic greetings like "Hello", "Hi", "নমস্কার", "আসসালামু আলাইকুম", or "নমস্তে". Jump straight into directly answering with warmth and clarity.

HYPERLINK PROTOCOL (MANDATORY):
- Whenever you mention a website, email address, or WhatsApp link, format them as active markdown hyperlinks:
  • Website: [towastore.shop](https://towastore.shop)
  • WhatsApp: [WhatsApp: +8801995981302](https://wa.me/8801995981302)
  • Email: [info.towastore@gmail.com](mailto:info.towastore@gmail.com) or [customer.towastore@yahoo.com](mailto:customer.towastore@yahoo.com)

PRODUCT INTEREST & SPECIAL "ADD TO CART" PROPOSAL:
- When a customer shows genuine interest in any specific product:
  1. Explain that product nicely with its benefits, exact price (৳), and packaging details in a helpful human way.
  2. Ask them courteously if they would like to order it (e.g. "আপনি কি এই পণ্যটি অর্ডার করতে চাচ্ছেন?" / "Would you like to order this item today?").
  3. Include an explicit metadata tag at the very end of your response:
     [[PRODUCT: exact_product_name | price | category | handle]]
     (Example: [[PRODUCT: Dano skimmed milk powder 500 gm | 400 | Dairy | dano-skimmed-milk-powder-500-gm]])

ORDER PLACEMENT (DO NOT CONFIRM ORDERS IN CHAT):
- Never confirm or charge orders inside this chat.
- Always gently remind the customer that orders are securely finalized directly on our official website [towastore.shop](https://towastore.shop) with 100% Cash on Delivery (COD) across all 64 districts in Bangladesh.

TECHNICAL ASSISTANCE & ESCALATION:
- If a customer reports any technical bug, login issue, payment problem, or order concern:
  Guide them warmly to reach out via [WhatsApp: +8801995981302](https://wa.me/8801995981302) or email [info.towastore@gmail.com](mailto:info.towastore@gmail.com) / [customer.towastore@yahoo.com](mailto:customer.towastore@yahoo.com).

STORE POLICIES:
- Payment: 100% Cash on Delivery (COD). No advance payment.
- Delivery: Inside Dhaka & Gazipur 24-48 hours. Outside Dhaka 3-5 business days.`;

export default async function handler(req: any, res: any) {
  // CORS headers for embedding widget into any external website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, preferredLanguage } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const catalogSummary = loadCatalog();

    const historyContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const dynamicInstruction =
      preferredLanguage === 'bn'
        ? `${SYSTEM_INSTRUCTION}\nLIVE CATALOG:\n${catalogSummary}\nCustomer language preference: Bengali (বাংলা). Reply warmly, respectfully, and naturally in Bengali.`
        : `${SYSTEM_INSTRUCTION}\nLIVE CATALOG:\n${catalogSummary}\nCustomer language preference: English. Reply warmly, respectfully, and naturally in English.`;

    const CANDIDATE_MODELS = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    let replyText = '';
    let lastError: any = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: historyContents,
          config: {
            systemInstruction: dynamicInstruction,
          },
        });

        if (response && response.text) {
          replyText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed:`, err?.message);
      }
    }

    if (!replyText) {
      throw lastError || new Error('No model returned a response');
    }

    // Product detection tag
    let featuredProduct: any = null;
    const productTagMatch = replyText.match(/\[\[PRODUCT:\s*([^|\]]+)\s*\|\s*([^|\]]+)\s*\|\s*([^|\]]+)(?:\s*\|\s*([^\]]+))?\]\]/i);
    if (productTagMatch) {
      featuredProduct = {
        name: productTagMatch[1]?.trim(),
        price: productTagMatch[2]?.trim().replace(/[^\d.]/g, '') || '0',
        category: productTagMatch[3]?.trim(),
        handle: productTagMatch[4]?.trim() || '',
        url: 'https://towastore.shop',
      };
      replyText = replyText.replace(/\[\[PRODUCT:[^\]]+\]\]/gi, '').trim();
    }

    return res.status(200).json({ reply: replyText, product: featuredProduct });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to process request', details: error?.message });
  }
}
