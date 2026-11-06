import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dedicated API Key for Towa Support AI
const EFFECTIVE_API_KEY = process.env.GEMINI_API_KEY || '';

// Official Contact details discovered directly from towastore.shop:
const TOWA_CONTACTS = {
  website: 'https://towastore.shop',
  whatsapp: '+8801995981302',
  whatsappLink: 'https://wa.me/8801995981302',
  phone: '+8801995981302',
  emails: ['info.towastore@gmail.com', 'customer.towastore@yahoo.com'],
};

interface ProductItem {
  handle: string;
  sku: string;
  name: string;
  category: string;
  price: string;
  inStock: string;
}

async function createServer() {
  const app = express();
  app.use(express.json());

  // Load product catalog CSV and parse structured products
  const productsList: ProductItem[] = [];
  let productCatalogSummary = '';
  try {
    const csvPath = path.join(
      __dirname,
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
      productCatalogSummary = `TOWA PRODUCT CATALOG (${productsList.length} live items):\n` + linesFormatted.join('\n');
    }
  } catch (err) {
    console.error('Failed reading catalog CSV:', err);
  }

  // Initialize Gemini Client
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
- Whenever you mention a website, email address, or WhatsApp link, you MUST format them as active markdown hyperlinks so the customer can tap/click them directly:
  • Website: [towastore.shop](https://towastore.shop)
  • WhatsApp: [WhatsApp: +8801995981302](https://wa.me/8801995981302)
  • Email: [info.towastore@gmail.com](mailto:info.towastore@gmail.com) or [customer.towastore@yahoo.com](mailto:customer.towastore@yahoo.com)

PRODUCT INTEREST & SPECIAL "ADD TO CART" PROPOSAL:
- When a customer shows genuine interest in any specific product or asks about its details:
  1. Explain that product nicely with its benefits, exact price (৳), and packaging details in a helpful human way.
  2. Ask them courteously if they would like to order it (e.g. "আপনি কি এই পণ্যটি অর্ডার করতে চাচ্ছেন?" / "Would you like to order this item today?").
  3. When recommending or highlighting a specific product, include an explicit metadata tag at the very end of your response so the interactive Add-to-Cart floating window pops up for the user:
     [[PRODUCT: exact_product_name | price | category | handle]]
     (Example: [[PRODUCT: Dano skimmed milk powder 500 gm | 400 | Dairy | dano-skimmed-milk-powder-500-gm]])
     Only include this tag when discussing or recommending a specific item.

ORDER PLACEMENT (DO NOT CONFIRM ORDERS IN CHAT):
- Never confirm or charge orders inside this chat.
- Always gently remind the customer that orders are securely finalized directly on our official website [towastore.shop](https://towastore.shop) with 100% Cash on Delivery (COD) across all 64 districts in Bangladesh.

TECHNICAL ASSISTANCE & ESCALATION:
- If a customer reports any technical bug, login issue, payment problem, or order concern:
  Guide them warmly to reach out via [WhatsApp: +8801995981302](https://wa.me/8801995981302) or email [info.towastore@gmail.com](mailto:info.towastore@gmail.com) / [customer.towastore@yahoo.com](mailto:customer.towastore@yahoo.com).

STORE POLICIES:
- Payment: 100% Cash on Delivery (COD). No advance payment.
- Delivery: Inside Dhaka & Gazipur 24-48 hours. Outside Dhaka 3-5 business days.

LIVE PRODUCT CATALOG DATA:
${productCatalogSummary}`;

  // Candidate models
  const CANDIDATE_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];

  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, preferredLanguage } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      // Convert conversation history into GenAI format
      const historyContents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      // Add language context
      const dynamicInstruction =
        preferredLanguage === 'bn'
          ? `${SYSTEM_INSTRUCTION}\nCustomer language preference: Bengali (বাংলা). Reply warmly, respectfully, and naturally in Bengali unless the user writes in English.`
          : `${SYSTEM_INSTRUCTION}\nCustomer language preference: English. Reply warmly, respectfully, and naturally in polished English unless the user writes in Bengali.`;

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
        } catch (modelError: any) {
          lastError = modelError;
          console.warn(`Model ${model} attempt failed:`, modelError?.message || modelError);
        }
      }

      if (!replyText) {
        throw lastError || new Error('No model returned a response');
      }

      // Check if response contains product recommendation tag [[PRODUCT: name | price | category | handle]]
      let featuredProduct: any = null;
      const productTagMatch = replyText.match(/\[\[PRODUCT:\s*([^|\]]+)\s*\|\s*([^|\]]+)\s*\|\s*([^|\]]+)(?:\s*\|\s*([^\]]+))?\]\]/i);
      if (productTagMatch) {
        const rawName = productTagMatch[1]?.trim();
        const rawPrice = productTagMatch[2]?.trim().replace(/[^\d.]/g, '');
        const rawCategory = productTagMatch[3]?.trim();
        const rawHandle = productTagMatch[4]?.trim() || '';
        featuredProduct = {
          name: rawName,
          price: rawPrice || '0',
          category: rawCategory,
          handle: rawHandle,
          url: `https://towastore.shop`,
        };
        // Clean out the internal tag from the visible text
        replyText = replyText.replace(/\[\[PRODUCT:[^\]]+\]\]/gi, '').trim();
      } else {
        // Fallback: check if the latest customer message mentions a specific known product
        const lastUserText = messages[messages.length - 1]?.content?.toLowerCase() || '';
        const found = productsList.find((p) => {
          const pNameLower = p.name.toLowerCase();
          return (
            (pNameLower.length > 5 && lastUserText.includes(pNameLower)) ||
            (pNameLower.includes('dano') && lastUserText.includes('dano')) ||
            (pNameLower.includes('atta') && (lastUserText.includes('আটা') || lastUserText.includes('atta'))) ||
            (pNameLower.includes('coca cola') && (lastUserText.includes('কোক') || lastUserText.includes('coke') || lastUserText.includes('coca'))) ||
            (pNameLower.includes('mustard oil') && (lastUserText.includes('সরিষার তেল') || lastUserText.includes('mustard')))
          );
        });
        if (found) {
          featuredProduct = {
            name: found.name,
            price: found.price,
            category: found.category,
            handle: found.handle,
            url: `https://towastore.shop`,
          };
        }
      }

      res.json({ reply: replyText, product: featuredProduct });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({
        error: 'AI service temporarily unavailable',
        details: error?.message || 'Server error',
      });
    }
  });

  // Catalog items list endpoint for search/reference
  app.get('/api/products', (req, res) => {
    res.json(productsList);
  });

  // Health and Contact info endpoint
  app.get('/api/contact', (req, res) => {
    res.json(TOWA_CONTACTS);
  });

  const PORT = 3000;
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Towa Support AI Server running on port ${PORT}`);
  });

  // Vite Middleware attached with the HTTP server for proper WebSocket upgrade handling
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer,
      },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
});
