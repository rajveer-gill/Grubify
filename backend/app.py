from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
from recipe_handler import fetch_recipe
from store_handler import fetch_ingredient_prices
from user import exchange_code_for_token, add_item_to_cart
from dotenv import load_dotenv
from data import Database
import requests
import os

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = "some-secret-key"  # Required for session management
SPOONACULAR_API_KEY = os.environ.get('SPOONACULAR_API_KEY')


# Enable CORS with credentials
CORS(app, resources={r"/*": {"origins": "https://grubify.ai"}})


# Configure session cookies for cross-origin requests
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True  # Ensure cookies are only sent over HTTPS

# Kroger API constants
CLIENT_ID = os.environ["KROGER_CLIENT_ID"]
REDIRECT_URI = "https://grubify.onrender.com/callback"
AUTH_URL = "https://api.kroger.com/v1/connect/oauth2/authorize"  # Add this line

@app.route("/test", methods=["GET", "POST"])
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
    print(data)
    
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
        
        db.insert_recipe(data)
        
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

@app.route("/add-to-cart", methods=["POST"])
def add_to_cart_route():
    user_token = session.get("kroger_user_token")
    if not user_token:
        print("No token found in session")  # Debugging
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
        print(f"📦 Searching for: {ingredient}")
        products = kroger_api.search_products(ingredient, location_id=store_id)

        if not products:
            print(f"⚠️ No products found for {ingredient}")
            missing_items.append(ingredient)
            success_list.append(False)
            continue

        if not products:
            print(f"No products found for {ingredient}")
            success_list.append(False)
            continue
        
        # Pick the first matching product
        first_product = min(products.values(), key=lambda x: x.get("Price", float('inf')))
          # take the first result
        upc = first_product.get("UPC")
        
        if upc:
            success = add_item_to_cart(user_token, upc, quantity=1, modality="PICKUP")
            success_list.append(success)
        else:
            print(f"No UPC found for {ingredient}")
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

@app.route("/refine-recipe", methods=["POST"])
def refine_recipe():
    data = request.get_json()
    original_recipe = data.get("original_recipe")
    edit_instruction = data.get("edit_instruction")

    if not original_recipe or not edit_instruction:
        return jsonify({"error": "Missing original recipe or instruction"}), 400

    openai_key = os.environ.get("OPENAI_API_KEY")
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json"
    }

    prompt = f"""You are an assistant that modifies recipes based on user requests.
    Here is the original recipe:
    {original_recipe}

    Please modify it based on this user instruction:
    {edit_instruction}

    Return the result in structured JSON format with 'name', 'ingredients' (array), and 'instructions' (array)."""

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers=headers,
        json={
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "You are a helpful AI recipe assistant."},
                {"role": "user", "content": prompt}
            ]
        }
    )

    if response.status_code == 200:
        new_recipe = response.json()["choices"][0]["message"]["content"]
        return jsonify({"updated_recipe": new_recipe})
    else:
        print("Error refining recipe:", response.text)
        return jsonify({"error": "Failed to refine recipe"}), 500

@app.route('/calculate-nutrition', methods=['POST'])
def calculate_nutrition():
    try:
        data = request.get_json()
        ingredients = data.get('ingredients', [])

        if not ingredients:
            return jsonify({"error": "No ingredients provided"}), 400

        total_calories = 0
        total_protein = 0
        total_carbs = 0
        total_fat = 0
        total_fiber = 0
        total_sugar = 0
        total_sodium = 0

        for item in ingredients:
            ingredient_name = item.get('name')
            amount = item.get('amount', '')

            if not ingredient_name:
                continue

            # Search for ingredient nutrition
            search_url = f"https://api.spoonacular.com/food/ingredients/search"
            search_params = {
                "query": ingredient_name,
                "apiKey": SPOONACULAR_API_KEY
            }
            search_response = requests.get(search_url, params=search_params)
            search_data = search_response.json()

            if not search_data.get('results'):
                continue  # No ingredient found

            ingredient_id = search_data['results'][0]['id']

            # Get detailed nutrition info
            info_url = f"https://api.spoonacular.com/food/ingredients/{ingredient_id}/information"
            info_params = {
                "amount": 1,
                "unit": "serving",
                "apiKey": SPOONACULAR_API_KEY
            }
            info_response = requests.get(info_url, params=info_params)
            info_data = info_response.json()

            # Pull macros
            nutrition = info_data.get('nutrition', {})
            nutrients = nutrition.get('nutrients', [])

            calories = next((n['amount'] for n in nutrients if n['name'] == 'Calories'), 0)
            protein = next((n['amount'] for n in nutrients if n['name'] == 'Protein'), 0)
            carbs = next((n['amount'] for n in nutrients if n['name'] == 'Carbohydrates'), 0)
            fat = next((n['amount'] for n in nutrients if n['name'] == 'Fat'), 0)
            fiber = next((n['amount'] for n in nutrients if n['name'] == 'Fiber'), 0)
            sugar = next((n['amount'] for n in nutrients if n['name'] == 'Sugar'), 0)
            sodium = next((n['amount'] for n in nutrients if n['name'] == 'Sodium'), 0)


            total_calories += calories
            total_protein += protein
            total_carbs += carbs
            total_fat += fat
            total_fiber += fiber
            total_sugar += sugar
            total_sodium += sodium


        return jsonify({
            "calories": round(total_calories),
            "protein": round(total_protein, 1),
            "carbs": round(total_carbs, 1),
            "fat": round(total_fat, 1),
            "fiber": round(total_fiber, 1),
            "sugar": round(total_sugar, 1),
            "sodium": round(total_sodium)
        })

    except Exception as e:
        print(f"🔥 Error calculating nutrition: {str(e)}")
        return jsonify({"error": "Failed to calculate nutrition"}), 500



if __name__ == "__main__":
    app.run(debug=True, port=5000)