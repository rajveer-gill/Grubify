const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const cors = require("cors")({
  origin: ["https://grubify.ai", "https://grubify-9cf13.firebaseapp.com", "https://grubify-9cf13.web.app"],
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

exports.generateRecipe = onRequest({ secrets: [openaiKey] }, async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        return res.status(204).send('');
      }
  
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }
  
      try {
        const description = req.body.description;
  
        const completion = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant that generates recipes based on user input. Return the recipe in JSON format with 'name', 'ingredients' (array of { name, amount }), and 'instructions' (array of steps).",
              },
              {
                role: "user",
                content: `Generate a recipe for: ${description}`,
              },
            ],
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey.value()}`,
            },
          }
        );
  
        const text = completion.data.choices[0].message.content;
  
        const recipeJson = JSON.parse(text);
  
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

  exports.addToKrogerCart = onRequest({
    secrets: [krogerClientId, krogerClientSecret],
  }, async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        return res.status(204).send('');
      }
      
      try {  
        const items = req.body.items;
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: "No items provided" });
        }
    
        // Get Kroger access token
        const tokenRes = await axios.post(
          "https://api.kroger.com/v1/connect/oauth2/token",
          new URLSearchParams({
            grant_type: "client_credentials",
            scope: "product.compact",
          }),
          {
            auth: {
              username: krogerClientId.value(),
              password: krogerClientSecret.value(),
            },
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
  
        const accessToken = tokenRes.data.access_token;
        const results = [];

        for (const item of items) {
          try {
            const response = await axios.get(
              `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(item)}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            // extract the first matching product/item
            const productData = response.data.data?.[0]?.items?.[0];
            if (!productData) throw new Error("No products found");
            results.push({ item, productData });
          } catch (innerError) {
            console.error(`❌ Error fetching "${item}":`, innerError.response?.data || innerError.message);
            results.push({ item, error: true });
          }
        }

        const sampleRes = await axios.get(
          `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(items[0])}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // extract UPC from the first matching product
        const product = sampleRes.data.data && sampleRes.data.data[0];
        const { upc } = product || {};
        
        if (!upc) {
          throw new Error("No UPC found for product");
        }

        const authHeader = req.headers.authorization;
        const userToken = authHeader?.split(" ")[1];

        if (!userToken) {
          return res.status(401).json({ error: "Missing Kroger user token" });
        }

        // actually add the item to the cart, with error logging
        try {
          const addRes = await axios.put(
            "https://api.kroger.com/v1/cart/add",
            {
              items: [
                {
                  upc,
                  quantity: 1,
                  modality: "PICKUP",
                }
              ]
            },
            { headers: { Authorization: `Bearer ${userToken}` } }
          );

          return res.status(addRes.status).json({ success: true });
        } catch (err) {
          console.error("🔥 Kroger add-to-cart failed:", err.response?.data || err.message);
          return res.status(500).json({ error: "Failed to add to cart" });
        }
      } catch (err) {
        console.error("⚠️ Error in addToKrogerCart:", err.response?.data || err.message);
        return res.status(500).json({ error: "Unexpected error in addToKrogerCart" });
      }
  });
});
  
  

  
