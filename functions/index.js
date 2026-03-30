const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const ALLOWED_ORIGINS = [
  "https://grubify.ai",
  "https://grubify-9cf13.firebaseapp.com",
  "https://grubify-9cf13.web.app",
];

const cors = require("cors")({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});


const openaiKey = defineSecret("OPENAI_API_KEY");
const krogerClientId = defineSecret("KROGER_CLIENT_ID");
const krogerClientSecret = defineSecret("KROGER_CLIENT_SECRET");

async function requireFirebaseUser(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    const err = new Error("Missing or invalid Authorization header");
    err.statusCode = 401;
    throw err;
  }
  const idToken = h.slice(7);
  return admin.auth().verifyIdToken(idToken);
}

/** Gen2 / Cloud Run may not populate req.body; rawBody holds JSON bytes. */
function getJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (req.rawBody && Buffer.isBuffer(req.rawBody) && req.rawBody.length) {
    try {
      return JSON.parse(req.rawBody.toString("utf8"));
    } catch (e) {
      console.warn("[getJsonBody] rawBody JSON parse failed", e.message);
    }
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      /* ignore */
    }
  }
  return {};
}

function parseJsonFromModelContent(text) {
  const t = (text || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    /* continue */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const i = t.indexOf("{");
  if (i >= 0) {
    try {
      return JSON.parse(t.slice(i));
    } catch {
      /* continue */
    }
  }
  throw new Error("Model output was not valid JSON");
}

function normalizeRecipeIngredient(ing) {
  const name =
    typeof ing?.name === "string" ? ing.name.trim() : String(ing?.name ?? "").trim();
  const amount =
    typeof ing?.amount === "string" ? ing.amount : String(ing?.amount ?? "");
  let kq =
    typeof ing?.krogerSearchQuery === "string"
      ? ing.krogerSearchQuery.trim()
      : "";
  if (!kq && name) {
    kq =
      name
        .replace(/^[\d./\s-]+/, "")
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || name;
  }
  return { name, amount, krogerSearchQuery: kq };
}

function normalizeStructuredRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") {
    return { name: "Recipe", ingredients: [], instructions: [] };
  }
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map((x) => normalizeRecipeIngredient(x))
        .filter((x) => x.name)
    : [];
  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    name: String(recipe.name || "Recipe").trim() || "Recipe",
    ingredients,
    instructions,
  };
}

exports.generateRecipe = onRequest({ secrets: [openaiKey] }, async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        return res.status(204).send('');
      }
  
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }
  
      try {
        const body = getJsonBody(req);
        const description = body.description;
        if (!description || typeof description !== "string") {
          return res.status(400).json({ error: "description is required" });
        }

        const systemRules =
          "Return a single JSON object with keys: name (string), ingredients (array), instructions (array). " +
          "Each ingredient must be an object with: name (string), amount (string), " +
          "krogerSearchQuery (string): 2–6 words, grocery-shelf language only, no quantities in krogerSearchQuery. " +
          "JSON only.";

        const completion = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a helpful assistant that generates recipes. ${systemRules}`,
              },
              {
                role: "user",
                content: `Generate a recipe for: ${description}`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey.value()}`,
            },
          }
        );
  
        const text = completion.data.choices[0].message.content;
        const raw = parseJsonFromModelContent(text);
        const recipeJson = normalizeStructuredRecipe(raw);
  
        return res.status(200).json({
          structured_recipe: recipeJson,
          raw_text: text,
        });
      } catch (error) {
        console.error("🔥 Error generating recipe:", error.response?.data || error.message);
        return res.status(500).json({ error: "Failed to generate recipe" });
      }
    });
  });

  exports.krogerAuthToken = onRequest({
    secrets: [krogerClientId, krogerClientSecret],
  }, async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }
      try {
        await requireFirebaseUser(req);
        const clientId = krogerClientId.value();
        const clientSecret = krogerClientSecret.value();

        const response = await axios.post(
          "https://api.kroger.com/v1/connect/oauth2/token",
          new URLSearchParams({
            grant_type: "client_credentials",
            scope: "product.compact",
          }),
          {
            auth: {
              username: clientId,
              password: clientSecret,
            },
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        const accessToken = response.data.access_token;
        res.status(200).send({ accessToken });
      } catch (error) {
        if (error.statusCode === 401 || (error.code && String(error.code).startsWith("auth/"))) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        console.error("Error getting Kroger token:", error.response?.data || error.message);
        res.status(500).send({ error: "Failed to fetch Kroger token" });
      }
    });
  });

  exports.addToKrogerCart = onRequest({}, async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        return res.status(204).send('');
      }
      
      try {
        const authHeader = req.headers.authorization;
        const userToken = authHeader?.split(" ")[1];
        if (!userToken) {
          console.warn("[addToKrogerCart] missing Bearer user token");
          return res.status(401).json({ error: "Missing Kroger user token" });
        }

        const body = getJsonBody(req);
        const rawUpcs = body.upcs;
        console.log("[addToKrogerCart] POST", {
          upcCount: Array.isArray(rawUpcs) ? rawUpcs.length : 0,
          hasAuth: true,
          contentType: req.headers["content-type"],
          hasParsedBody: Object.keys(body).length > 0,
          rawBodyLen: req.rawBody ? req.rawBody.length : 0,
        });
        if (!rawUpcs || !Array.isArray(rawUpcs) || rawUpcs.length === 0) {
          console.warn("[addToKrogerCart] bad upcs payload");
          return res.status(400).json({ error: "No UPCs provided (expected body.upcs)" });
        }

        const seenUpc = new Set();
        const upcsOrdered = [];
        for (const u of rawUpcs) {
          const s = String(u ?? "").trim();
          if (!s) continue;
          if (!seenUpc.has(s)) {
            seenUpc.add(s);
            upcsOrdered.push(s);
          }
        }
        if (upcsOrdered.length === 0) {
          return res.status(400).json({ error: "No valid UPC strings in body.upcs" });
        }

        const addRes = await axios.put(
          "https://api.kroger.com/v1/cart/add",
          {
            items: upcsOrdered.map((upc) => ({
              upc,
              quantity: 1,
              modality: "PICKUP",
            })),
          },
          {
            headers: { Authorization: `Bearer ${userToken}` },
            validateStatus: () => true,
          }
        );

        if (addRes.status === 200 || addRes.status === 204) {
          console.log("[addToKrogerCart] cart/add OK", {
            krogerStatus: addRes.status,
            addedCount: upcsOrdered.length,
          });
          return res.status(200).json({
            success: true,
            addedCount: upcsOrdered.length,
            failedItems: [],
          });
        }

        const detail = addRes.data;
        console.error("[addToKrogerCart] Kroger cart/add failed", {
          status: addRes.status,
          detail: typeof detail === "object" ? JSON.stringify(detail) : detail,
        });
        if (addRes.status === 401 || addRes.status === 403) {
          return res.status(401).json({
            error: "Kroger rejected the cart request — sign out of Kroger in the app and connect again.",
            failedItems: [],
          });
        }
        return res.status(502).json({
          error: "Failed to add to cart",
          krogerStatus: addRes.status,
          failedItems: [],
          detail: typeof detail === "string" ? detail.slice(0, 500) : detail,
        });
      } catch (err) {
        const detail = err.response?.data ?? err.message;
        console.error("[addToKrogerCart] unexpected", {
          message: err.message,
          detail: typeof detail === "object" ? JSON.stringify(detail) : detail,
        });
        return res.status(500).json({ error: "Unexpected error in addToKrogerCart" });
      }
  });
});
  
  

  
