from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS, cross_origin
from recipe_handler import fetch_recipe
from kroger_search_expand import expand_kroger_search_terms
from kroger_website_search import search_upc_via_kroger_website
from recipe_schema import RECIPE_SYSTEM_JSON_RULES, normalize_recipe_dict, parse_search_upc_item
from store_handler import fetch_ingredient_prices
from user import exchange_code_for_token, add_item_to_cart
from dotenv import load_dotenv
from data import Database
from quantulum3 import parser as quantulum_parser
from concurrent.futures import ThreadPoolExecutor
import json as json_lib
import os
import requests
import time
import uuid

# Load environment variables
load_dotenv()

app = Flask(__name__)
_flask_secret = (
    os.environ.get("FLASK_SECRET_KEY") or os.environ.get("SECRET_KEY") or ""
).strip()
if not _flask_secret and os.environ.get("RENDER"):
    raise RuntimeError(
        "Set FLASK_SECRET_KEY or SECRET_KEY on Render (Environment): use a long random string, "
        "e.g. openssl rand -hex 32"
    )
app.secret_key = _flask_secret or "dev-only-not-for-production"
SPOONACULAR_API_KEY = os.environ.get('SPOONACULAR_API_KEY')

# Enable CORS (allow credentials) on every route — include Firebase Hosting for Kroger flows
CORS(
    app,
    origins=[
        "https://grubify.ai",
        "https://www.grubify.ai",
        "https://grubify-9cf13.firebaseapp.com",
        "https://grubify-9cf13.web.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    supports_credentials=True,
    expose_headers=["X-Request-Id"],
)



# Configure session cookies for cross-origin requests
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True  # Ensure cookies are only sent over HTTPS

# Kroger API constants
CLIENT_ID = os.environ["KROGER_CLIENT_ID"]
REDIRECT_URI = "https://grubify.onrender.com/callback"
AUTH_URL = "https://api.kroger.com/v1/connect/oauth2/authorize"  # Add this line
try:
    KROGER_WEB_SEARCH_TIMEOUT_SECONDS = max(
        5, int(os.environ.get("KROGER_WEB_SEARCH_TIMEOUT_SECONDS", "18"))
    )
except ValueError:
    KROGER_WEB_SEARCH_TIMEOUT_SECONDS = 18


def _resolve_kroger_term(term: str, req_id: str = ""):
    """One Kroger HTML search (+ optional OpenAI alternates). Used by ThreadPoolExecutor."""
    t0 = time.perf_counter()
    upc, http_status, detail = search_upc_via_kroger_website(
        term,
        timeout=KROGER_WEB_SEARCH_TIMEOUT_SECONDS,
    )
    retried_with = None
    if not upc and detail == "no_upc_in_page":
        for alt in expand_kroger_search_terms(term):
            u2, st2, d2 = search_upc_via_kroger_website(
                alt,
                timeout=KROGER_WEB_SEARCH_TIMEOUT_SECONDS,
            )
            if u2:
                upc, http_status, detail = u2, st2, d2
                retried_with = alt
                break
    elapsed = time.perf_counter() - t0
    rid = req_id or "-"
    upc_disp = upc or "-"
    retry_note = f" retry={retried_with!r}" if retried_with else ""
    print(
        f"[search-upcs req={rid}] term={term[:56]!r} upc={upc_disp} "
        f"detail={detail!r} http={http_status}{retry_note} {elapsed:.2f}s"
    )
    return (upc, http_status, detail, retried_with)


UNIT_TO_GRAMS = {
    'tablespoon': 15,  # very rough average
    'teaspoon': 5,
    'cup': 240,
    'gram': 1,
    'g': 1,
    'ounce': 28.35,
    'oz': 28.35,
    'pound': 453.6,
    'lb': 453.6
}

def estimate_grams_from_text(ingredient_text):
    if not ingredient_text or not isinstance(ingredient_text, str):
        return None

    quantities = quantulum_parser.parse(ingredient_text)
    if not quantities:
        return None

    # common per-cup gram estimates for various ingredients
    INGREDIENT_DENSITY = {
        "all-purpose flour": 120,
        "flour": 120,
        "sugar": 200,
        "brown sugar": 220,
        "butter": 227,   # 1 cup = ~2 sticks = 227g
        "milk": 245,
        "vanilla extract": 4.2,  # 1 tsp ~ 4.2g
        "baking powder": 4.6,    # 1 tsp ~ 4.6g
        "salt": 6,               # 1 tsp ~ 6g
        "egg": 50,
        "eggs": 50
    }

    for quantity in quantities:
        unit_name = quantity.unit.name.lower()
        value = quantity.value
        ingredient_lower = ingredient_text.lower()

        # cup-based ingredient-specific estimates
        if unit_name == "cup":
            for name, grams_per_cup in INGREDIENT_DENSITY.items():
                if name in ingredient_lower:
                    return value * grams_per_cup
            return value * 240  # fallback for unknown cups

        # teaspoon-based conversion (1 cup = ~48 tsp)
        if unit_name == "teaspoon":
            for name, grams_per_cup in INGREDIENT_DENSITY.items():
                if name in ingredient_lower:
                    return value * (grams_per_cup / 48)
            return value * 5  # fallback tsp

        # tablespoon-based conversion (1 cup = ~16 tbsp)
        if unit_name == "tablespoon":
            for name, grams_per_cup in INGREDIENT_DENSITY.items():
                if name in ingredient_lower:
                    return value * (grams_per_cup / 16)
            return value * 15  # fallback tbsp

        if unit_name in UNIT_TO_GRAMS:
            return value * UNIT_TO_GRAMS[unit_name]

    return None


def normalize_ingredient_name(name):
    import re
    name = name.lower().strip()
    name = re.sub(r"\(.*?\)", "", name)  # remove anything in parentheses
    name = re.sub(r"\d+[^\s]*", "", name)  # remove "8oz", "2tbsp", etc.
    name = re.sub(r"[^a-z\s]", "", name)  # strip punctuation
    return name.strip()


def fetch_nutrition_from_spoonacular(ingredient_name):
    cleaned = normalize_ingredient_name(ingredient_name)
    print(f"🧼 Ingredient: {ingredient_name} → Cleaned: {cleaned}")

    # Step 1: Search Spoonacular for the ingredient
    url = f"https://api.spoonacular.com/food/ingredients/search"
    params = {
        "query": cleaned,
        "apiKey": SPOONACULAR_API_KEY
    }
    response = requests.get(url, params=params)

    if response.status_code != 200:
        print(f"❌ Failed to search ingredient: {cleaned}")
        return None

    data = response.json()
    results = data.get("results", [])
    if not results:
        print(f"⚠️ No matches for: {cleaned}")
        return None

    # Step 2: Get nutrition info for the top match
    ingredient_id = results[0]["id"]
    print(f"📎 Matched {cleaned} → ID: {ingredient_id}")

    url_info = f"https://api.spoonacular.com/food/ingredients/{ingredient_id}/information"
    params_info = {
        "amount": 100,
        "unit": "g",
        "apiKey": SPOONACULAR_API_KEY
    }
    info_res = requests.get(url_info, params=params_info)

    if info_res.status_code != 200:
        print(f"❌ Failed to fetch nutrition info for ID: {ingredient_id}")
        return None

    return info_res.json()



@app.route("/test", methods=["GET","POST"])
@cross_origin(origin="https://grubify.ai",
              methods=["GET","POST"],
              supports_credentials=True)
def test():
    return jsonify({"message": "CORS test endpoint"}), 200


@app.route("/")
def home():
    return jsonify({"message": "Welcome to Nutrify AI!"})

@app.route("/generate-recipe", methods=["POST"])
def generate_recipe():
    data = request.json
    user_prompt = data.get("description", "")
    recipe = fetch_recipe(user_prompt)
    return jsonify(recipe)

@app.route("/save-recipe", methods=["POST"])
def save_recipe():
    data = request.json

    if not data or 'recipe' not in data:
        return jsonify({
            'success': False,
            'error': 'Invalid request: missing recipe data'
        }), 400
    
    recipe_data = data['recipe']
    
    required_fields = ['name', 'ingredients', 'instructions']
    if not all(field in recipe_data for field in required_fields):
        return jsonify({
            'success': False,
            'error': 'Invalid recipe: missing required fields'
        }), 400
    
    try:
        db = Database()
        recipe_id = db.insert_recipe(data)
        return jsonify({
            'success': True,
            'message': 'Recipe saved successfully',
            'recipe_id': str(recipe_id)
        })
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error saving recipe: {str(e)}")
        
        # Return error response
        return jsonify({
            'success': False,
            'error': 'Failed to save recipe'
        }), 500

@app.route("/get-past", methods=["POST"])
def get_past_recipes():
    print("getting past...")
    db = Database()

    recipes = db.get_all_recipes()
    print(recipes)

    return jsonify(recipes)

@app.route("/fetch-prices", methods=["POST"])
def fetch_prices():
    data = request.json
    ingredients = data.get("ingredients", [])
    store = data.get("store", "kroger").lower()
    prices = fetch_ingredient_prices(ingredients, store)
    return jsonify(prices)


@app.route("/kroger/search-upcs", methods=["POST"])
def kroger_search_upcs():
    """
    Resolve ingredient names to Kroger UPCs via www.kroger.com search HTML.

    api.kroger.com/v1/products is blocked from cloud datacenter IPs (Akamai).
    The consumer site is a different origin and is fetched server-side from Render.
    kroger_token is still required so only clients that completed Kroger OAuth call this.
    """
    req_id = uuid.uuid4().hex[:10]
    t_req = time.perf_counter()
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    kroger_token = (data.get("kroger_token") or "").strip()
    origin = request.headers.get("Origin", "(no Origin header)")
    if not kroger_token:
        print(f"[search-upcs req={req_id}] reject 400: missing kroger_token origin={origin!r}")
        bad = jsonify({"error": "kroger_token is required"})
        bad.headers["X-Request-Id"] = req_id
        return bad, 400
    if not isinstance(items, list) or len(items) == 0:
        print(f"[search-upcs req={req_id}] reject 400: bad items origin={origin!r}")
        bad = jsonify({"error": "items must be a non-empty array"})
        bad.headers["X-Request-Id"] = req_id
        return bad, 400

    print(
        f"[search-upcs req={req_id}] start origin={origin!r} "
        f"items={len(items)} token_len={len(kroger_token)} "
        f"timeout_s={KROGER_WEB_SEARCH_TIMEOUT_SECONDS}"
    )

    upcs = []
    failed_items = []
    # Unique search terms resolved in parallel so total wall time stays under
    # Gunicorn's worker timeout (sequential Kroger fetches were ~20s each).
    lookup_cache = {}
    seen_terms = set()
    unique_terms = []
    for raw in items:
        term, _ = parse_search_upc_item(raw)
        if not term:
            continue
        ck = term.strip().lower()
        if ck not in seen_terms:
            seen_terms.add(ck)
            unique_terms.append(term)

    if unique_terms:
        # Resolve all distinct terms in one parallel batch (cap avoids runaway threads).
        # With max_workers=4 and 8 ingredients, wall time was ~2× Kroger latency and hit gunicorn's default 30s timeout.
        max_workers = min(16, max(1, len(unique_terms)))
        print(
            f"[search-upcs req={req_id}] unique_terms={len(unique_terms)} "
            f"workers={max_workers} terms={unique_terms!r}"
        )
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            resolved = list(
                ex.map(lambda t: _resolve_kroger_term(t, req_id), unique_terms)
            )
        for term, result in zip(unique_terms, resolved):
            lookup_cache[term.strip().lower()] = result

    for raw in items:
        term, label = parse_search_upc_item(raw)
        if not term:
            failed_items.append({"item": raw, "reason": "empty_term"})
            continue

        cache_key = term.strip().lower()
        upc, http_status, detail, retried_with = lookup_cache[cache_key]

        if detail.startswith("request_error"):
            failed_items.append(
                {"item": label or term, "reason": "request_error", "detail": detail}
            )
            continue
        if not upc:
            entry = {
                "item": label or term,
                "reason": "no_upc" if detail == "no_upc_in_page" else "product_search_failed",
                "detail": detail,
            }
            if http_status:
                entry["krogerStatus"] = http_status
            failed_items.append(entry)
            continue
        # Keep one UPC per input ingredient so downstream cart quantities
        # can reflect how many ingredients mapped to the same product.
        upcs.append(upc)

    elapsed_req = time.perf_counter() - t_req
    fail_reasons = [f.get("reason", "?") for f in failed_items]
    print(
        f"[search-upcs req={req_id}] done in {elapsed_req:.2f}s "
        f"upcs={len(upcs)} failed={len(failed_items)} reasons={fail_reasons!r}"
    )

    ok = jsonify({"upcs": upcs, "failedItems": failed_items})
    ok.headers["X-Request-Id"] = req_id
    return ok


@app.route("/add-to-cart", methods=["POST"])
def add_to_cart_route():
    user_token = session.get("kroger_user_token")
    if not user_token:
        return jsonify({"success": False, "error": "User not logged in to Kroger"}), 401

    data = request.json
    ingredients = data.get("items", [])
    if not ingredients:
        return jsonify({"success": False, "error": "No items provided"}), 400

    # Create a Kroger API instance for product lookup
    from store_handler import KrogerAPI
    client_id = os.environ["KROGER_CLIENT_ID"]
    client_secret = os.environ["KROGER_CLIENT_SECRET"]
    kroger_api = KrogerAPI(client_id, client_secret)
    
    # Get access token for product search
    search_token = kroger_api.request_token() # kroger_api.request_token()
    if not search_token:
        return jsonify({"success": False, "error": "Failed to authenticate for product search"}), 500
    
    # Search for products to get UPCs
    stores = kroger_api.get_kroger_stores(zip_code="97401", limit=1)
    if not stores:
        return jsonify({"success": False, "error": "No Kroger stores found"}), 500
    
    store_id = stores[0]["id"]
    success_list = []

    for ingredient in ingredients:
        products = kroger_api.search_products(ingredient, location_id=store_id)

        if not products:
            success_list.append(False)
            continue

        first_product = min(products.values(), key=lambda x: x.get("Price", float("inf")))
        upc = first_product.get("UPC")
        
        if upc:
            success = add_item_to_cart(user_token, upc, quantity=1, modality="PICKUP")
            success_list.append(success)
        else:
            success_list.append(False)


    if all(success_list) and success_list:
        return jsonify({"success": True, "message": f"Added {len(success_list)} items to Kroger cart"})
    else:
        return jsonify({"success": False, "error": "One or more items failed to add."})

@app.route("/login")
def login():
    """
    Redirects the user to Kroger's OAuth2 authorization endpoint
    requesting the cart.basic:write scope (so we can modify the cart).
    """
    scope = "cart.basic:write"
    authorize_url = (
        f"{AUTH_URL}?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scope}"
    )
    return redirect(authorize_url)

@app.route("/callback")
def callback():
    """
    Kroger redirects here with ?code=XXXX after user logs in.
    We exchange that code for a user-level token, then store it in session.
    """
    auth_code = request.args.get("code", None)
    if not auth_code:
        return "No code provided by Kroger."

    user_token = exchange_code_for_token(auth_code)
    if not user_token:
        return "Failed to get user token from Kroger."

    # Store token in session
    session["kroger_user_token"] = user_token
    #print("Token stored in session:", user_token) 

    # Redirect back to the React app with a success query parameter
    return redirect("https://grubify.ai/?authSuccess=true")

@app.route("/token/", methods=["GET"])
@cross_origin(origin="https://grubify.ai", methods=["GET"], supports_credentials=True)
def token():
    """
    Returns the user-level Kroger token stored in session.
    """
    user_token = session.get("kroger_user_token")
    if not user_token:
        return jsonify({"error": "User not logged in to Kroger"}), 401
    return jsonify({"user_token": user_token})

@app.route("/refine-recipe", methods=["POST"])
def refine_recipe():
    data = request.get_json()
    original_recipe = data.get("original_recipe")
    edit_instruction = data.get("edit_instruction")

    if not original_recipe or not edit_instruction:
        return jsonify({"error": "Missing original recipe or instruction"}), 400

    openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not openai_key:
        return jsonify({"error": "OpenAI not configured"}), 500

    user_payload = json_lib.dumps(
        {"original_recipe": original_recipe, "edit_instruction": edit_instruction},
        ensure_ascii=False,
    )
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "You modify recipes based on user instructions. "
                    + RECIPE_SYSTEM_JSON_RULES,
                },
                {"role": "user", "content": user_payload},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.5,
        },
        timeout=90,
    )

    if response.status_code != 200:
        print("Error refining recipe:", response.text)
        return jsonify({"error": "Failed to refine recipe"}), 500

    response_text = response.json()["choices"][0]["message"]["content"]
    try:
        parsed_recipe = json_lib.loads(response_text.strip())
        parsed_recipe = normalize_recipe_dict(parsed_recipe)
        return jsonify(parsed_recipe)
    except Exception as e:
        print("❌ Failed to parse recipe JSON:", str(e))
        print("🔎 Raw response text:", response_text[:800] if response_text else "")
        return jsonify({"error": "Failed to parse structured recipe"}), 500

@app.route('/calculate-nutrition', methods=['POST'])
@cross_origin(origin="https://grubify.ai",
              methods=["POST"],
              supports_credentials=True)
def calculate_nutrition():
    try:
        data = request.get_json()
        ingredients = data.get('ingredients', [])

        if not ingredients:
            return jsonify({"error": "No ingredients provided"}), 400

        total_nutrition = {
            'calories': 0,
            'protein': 0,
            'carbs': 0,
            'fat': 0,
            'fiber': 0,
            'sugar': 0,
            'sodium': 0
        }

        for ingredient in ingredients:
            ingredient_name = ingredient.get('name', '')
            ingredient_amount = ingredient.get('amount', '')

            if not ingredient_name:
                continue

            grams_estimated = estimate_grams_from_text(ingredient_amount)
            print("🧪 INGREDIENT INPUT:", ingredient_name, "(", ingredient_amount, ")")
            print("📦 ESTIMATED GRAMS:", grams_estimated)

            if grams_estimated is None:
                grams_estimated = 100  # fallback if we can't parse, assume 100g

            nutrition_data = fetch_nutrition_from_spoonacular(ingredient_name)
            if not nutrition_data:
                print("❌ No nutrition data found for:", ingredient_name)
                continue  # skip if lookup failed

            nutrients = nutrition_data.get('nutrition', {}).get('nutrients', [])
            print("✅ SPOONACULAR MATCH:", nutrition_data.get("name", "unknown"))
            print("📊 Nutrients returned:", [n['name'] for n in nutrients])

            print(f"🧪 {ingredient_name} nutrients:", [n['name'] for n in nutrients])

            calories = next((n['amount'] for n in nutrients if n['name'].lower() == 'calories'), 0)
            protein = next((n['amount'] for n in nutrients if n['name'].lower() == 'protein'), 0)
            fat = next((n['amount'] for n in nutrients if n['name'].lower() == 'fat'), 0)
            carbs = next((n['amount'] for n in nutrients if 'carbohydrate' in n['name'].lower()), 0)
            sugar = next((n['amount'] for n in nutrients if 'sugar' in n['name'].lower()), 0)
            fiber = next((n['amount'] for n in nutrients if 'fiber' in n['name'].lower()), 0)
            sodium = next((n['amount'] for n in nutrients if 'sodium' in n['name'].lower()), 0)

            print(f"📥 Nutrient values for {ingredient_name}:")
            print(f"  Calories: {calories}")
            print(f"  Protein: {protein}g")
            print(f"  Fat: {fat}g")
            print(f"  Carbs: {carbs}g")
            print(f"  Sugar: {sugar}g")
            print(f"  Fiber: {fiber}g")
            print(f"  Sodium: {sodium}mg")


            scaling_factor = grams_estimated / 100

            print(f"  Scaling by: {scaling_factor}")

            total_nutrition['calories'] += calories * scaling_factor
            total_nutrition['protein'] += protein * scaling_factor
            total_nutrition['fat'] += fat * scaling_factor
            total_nutrition['carbs'] += carbs * scaling_factor
            total_nutrition['sugar'] += sugar * scaling_factor
            total_nutrition['fiber'] += fiber * scaling_factor
            total_nutrition['sodium'] += sodium * scaling_factor

            print("📊 Running totals:")
            for k, v in total_nutrition.items():
                print(f"  {k}: {v}")


        # round the results nicely
        for key in total_nutrition:
            total_nutrition[key] = round(total_nutrition[key], 2)

        return jsonify(total_nutrition)

    except Exception as e:
        print("Error calculating nutrition:", str(e))
        return jsonify({"error": "Server error calculating nutrition"}), 500



if __name__ == "__main__":
    app.run(debug=True, port=5000)