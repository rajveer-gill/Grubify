from flask import Flask, request, jsonify
from flask_cors import CORS
from recipe_handler import fetch_recipe
from store_handler import fetch_ingredient_prices
from cart_handler import add_to_cart
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

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

@app.route("/fetch-prices", methods=["POST"])
def fetch_prices():
    data = request.json
    ingredients = data.get("ingredients", [])
    store = data.get("store", "kroger").lower()
    prices = fetch_ingredient_prices(ingredients, store)
    return jsonify(prices)

@app.route("/add-to-cart", methods=["POST"])
def add_to_cart_route():
    data = request.json
    items = data.get("items", [])
    store = data.get("store", "kroger")
    response = add_to_cart(items, store)
    return jsonify(response)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
