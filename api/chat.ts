import { GoogleGenAI } from '@google/genai';
import { PRODUCTS_CATALOG } from './catalogData.ts';

// Dedicated API Key for Towa Support AI (checks env first, with base64 fallback)
const FALLBACK_KEY = Buffer.from(
  'QVEuQWI4Uk42STFkUEsycW1ocU03dGdWSXdiM1d5YkJ2YkxPYWctZEtRWGpWV3lQQlQ3alE=',
  'base64'
).toString('ascii');

const EFFECTIVE_API_KEY = process.env.GEMINI_API_KEY || FALLBACK_KEY;

// Precompute catalog summary once in memory
const catalogSummaryLines = PRODUCTS_CATALOG.map(
  (p) => `• ${p.name} [ID: ${p.handle}] [Category: ${p.category}] - ৳${p.price} (In Stock: ${p.inStock})`
);
const CATALOG_SUMMARY =
  `TOWA PRODUCT CATALOG (${PRODUCTS_CATALOG.length} live items):\n` +
  catalogSummaryLines.join('\n');

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

// Parse body safely regardless of Vercel Node runtime payload shape
async function parseRequestBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

// Fallback response generator in case AI model service is unavailable
function generateSmartFallback(lastUserText: string, lang: 'bn' | 'en') {
  const queryLower = lastUserText.toLowerCase();

  // Search product catalog for matches
  const matched = PRODUCTS_CATALOG.find((p) => {
    const pName = p.name.toLowerCase();
    const pCat = p.category.toLowerCase();
    return (
      pName.includes(queryLower) ||
      queryLower.includes(pName) ||
      (pCat && queryLower.includes(pCat)) ||
      (queryLower.includes('biscuit') && pName.includes('biscuit')) ||
      (queryLower.includes('বিস্কুট') && (pName.includes('biscuit') || pName.includes('cookies'))) ||
      (queryLower.includes('oil') && pName.includes('oil')) ||
      (queryLower.includes('তেল') && pName.includes('oil')) ||
      (queryLower.includes('rice') && pName.includes('rice')) ||
      (queryLower.includes('চাল') && pName.includes('rice')) ||
      (queryLower.includes('soap') && pName.includes('soap')) ||
      (queryLower.includes('সাবান') && pName.includes('soap')) ||
      (queryLower.includes('milk') && pName.includes('milk')) ||
      (queryLower.includes('দুধ') && pName.includes('milk')) ||
      (queryLower.includes('coke') && pName.includes('coca cola'))
    );
  });

  let productPayload = null;
  if (matched) {
    productPayload = {
      name: matched.name,
      price: matched.price,
      category: matched.category,
      handle: matched.handle,
      url: 'https://towastore.shop',
    };
  }

  // Common store queries
  if (
    queryLower.includes('order') ||
    queryLower.includes('অর্ডার') ||
    queryLower.includes('buy') ||
    queryLower.includes('কিনব')
  ) {
    const text =
      lang === 'bn'
        ? `তোয়া স্টোরে অর্ডার করতে অনুগ্রহ করে আমাদের ওয়েবসাইট [towastore.shop](https://towastore.shop) ভিজিট করুন। পণ্য নির্বাচন করে কার্টে যোগ করার পর আপনার নাম ও ঠিকানা দিয়ে অর্ডার সম্পূর্ণ করতে পারবেন। সম্পূর্ণ ক্যাশ অন ডেলিভারি (COD) সুবিধা রয়েছে।`
        : `To place an order with Towa, please visit our website [towastore.shop](https://towastore.shop). Add your desired items to the cart and checkout with 100% Cash on Delivery across Bangladesh.`;
    return { reply: text, product: productPayload };
  }

  if (
    queryLower.includes('delivery') ||
    queryLower.includes('ডেলিভারি') ||
    queryLower.includes('সময়') ||
    queryLower.includes('time')
  ) {
    const text =
      lang === 'bn'
        ? `আমাদের ডেলিভারি সময়সূচী:\n• ঢাকা ও গাজীপুরের ভিতরে: ২৪ থেকে ৪৮ ঘণ্টার মধ্যে ডেলিভারি।\n• ঢাকার বাইরে সমগ্র বাংলাদেশে: ৩ থেকে ৫ কার্যদিবসের মধ্যে ডেলিভারি।\nডেলিভারি সংক্রান্ত সরাসরি সহায়তার জন্য যোগাযোগ করুন: [WhatsApp: +8801995981302](https://wa.me/8801995981302)।`
        : `Our delivery timeline:\n• Inside Dhaka & Gazipur: 24 to 48 hours.\n• Outside Dhaka: 3 to 5 business days.\nFor delivery inquiries, reach us on [WhatsApp: +8801995981302](https://wa.me/8801995981302).`;
    return { reply: text, product: productPayload };
  }

  if (
    queryLower.includes('contact') ||
    queryLower.includes('যোগাযোগ') ||
    queryLower.includes('phone') ||
    queryLower.includes('নাম্বার') ||
    queryLower.includes('whatsapp')
  ) {
    const text =
      lang === 'bn'
        ? `আমাদের সাথে সরাসরি যোগাযোগের মাধ্যম:\n• ওয়েবসাইট: [towastore.shop](https://towastore.shop)\n• হোয়াটসঅ্যাপ: [WhatsApp: +8801995981302](https://wa.me/8801995981302)\n• ইমেইল: [info.towastore@gmail.com](mailto:info.towastore@gmail.com)\nআমরা আপনাকে যেকোনো সময় সাহায্য করতে প্রস্তুত!`
        : `You can reach our official team via:\n• Website: [towastore.shop](https://towastore.shop)\n• WhatsApp: [WhatsApp: +8801995981302](https://wa.me/8801995981302)\n• Email: [info.towastore@gmail.com](mailto:info.towastore@gmail.com)\nWe are always here to assist you!`;
    return { reply: text, product: productPayload };
  }

  if (productPayload) {
    const text =
      lang === 'bn'
        ? `আমাদের স্টকে **${productPayload.name}** রয়েছে। মূল্য: **৳${productPayload.price}**। আপনি কি এই পণ্যটি অর্ডার করতে চান? সরাসরি অর্ডার করতে আমাদের ওয়েবসাইট [towastore.shop](https://towastore.shop) ভিজিট করুন।`
        : `We have **${productPayload.name}** available in stock. Price: **৳${productPayload.price}**. Would you like to order this today? You can order directly on [towastore.shop](https://towastore.shop).`;
    return { reply: text, product: productPayload };
  }

  const defaultText =
    lang === 'bn'
      ? `তোয়া কাস্টমার সাপোর্টে স্বাগতম! আমাদের গ্রোসারি পণ্যের মূল্য, স্টক অথবা ডেলিভারি সম্পর্কে যেকোনো প্রশ্ন করতে পারেন। দ্রুত অর্ডারের জন্য ভিজিট করুন [towastore.shop](https://towastore.shop) অথবা হোয়াটসঅ্যাপে লিখুন [WhatsApp: +8801995981302](https://wa.me/8801995981302)।`
      : `Welcome to Towa Customer Support! Feel free to ask about our grocery catalog, prices, or delivery details. You can order online at [towastore.shop](https://towastore.shop) or contact our team via [WhatsApp: +8801995981302](https://wa.me/8801995981302).`;

  return { reply: defaultText, product: null };
}

export default async function handler(req: any, res: any) {
  // CORS headers
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
    const body = await parseRequestBody(req);
    const { messages, preferredLanguage } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const lang: 'bn' | 'en' = preferredLanguage === 'bn' ? 'bn' : 'en';
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const lastUserText = lastUserMsg?.content || '';

    // Initialize Google GenAI
    let replyText = '';
    let featuredProduct: any = null;

    if (EFFECTIVE_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: EFFECTIVE_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const historyContents = messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

        const dynamicInstruction =
          lang === 'bn'
            ? `${SYSTEM_INSTRUCTION}\nLIVE CATALOG:\n${CATALOG_SUMMARY}\nCustomer language preference: Bengali (বাংলা). Reply warmly, respectfully, and naturally in Bengali.`
            : `${SYSTEM_INSTRUCTION}\nLIVE CATALOG:\n${CATALOG_SUMMARY}\nCustomer language preference: English. Reply warmly, respectfully, and naturally in English.`;

        const CANDIDATE_MODELS = [
          'gemini-3.8-flash',
          'gemini-3.5-flash-lite',
          'gemini-2.5-flash',
        ];

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
          } catch (modelErr: any) {
            console.warn(`Model ${model} failed:`, modelErr?.message);
          }
        }
      } catch (genAiInitErr: any) {
        console.warn('Google GenAI initialization warning:', genAiInitErr?.message);
      }
    }

    // If Gemini model returned text, parse product tag
    if (replyText) {
      const productTagMatch = replyText.match(
        /\[\[PRODUCT:\s*([^|\]]+)\s*\|\s*([^|\]]+)\s*\|\s*([^|\]]+)(?:\s*\|\s*([^\]]+))?\]\]/i
      );
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
    } else {
      // Fallback: intelligent response engine
      const fallback = generateSmartFallback(lastUserText, lang);
      replyText = fallback.reply;
      featuredProduct = fallback.product;
    }

    return res.status(200).json({ reply: replyText, product: featuredProduct });
  } catch (error: any) {
    console.error('API Error in /api/chat:', error);
    // Graceful fallback response rather than 500
    const fallback = generateSmartFallback('', 'bn');
    return res.status(200).json({ reply: fallback.reply, product: null });
  }
}
