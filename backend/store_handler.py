import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def fetch_ingredient_prices(ingredients, store):
    if store.lower() == "kroger":
        # Securely load API credentials
        token_url = "https://api.kroger.com/v1/connect/oauth2/token"
        client_id = os.getenv("KROGER_CLIENT_ID")
        client_secret = os.getenv("KROGER_CLIENT_SECRET")

        # Request access token
        token_response = requests.post(token_url, data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret
        })
        access_token = token_response.json().get("access_token")

        if not access_token:
            return {"error": "Failed to fetch Kroger API token"}

        # Fetch ingredient prices
        headers = {"Authorization": f"Bearer {access_token}"}
        product_url = "https://api.kroger.com/v1/products"
        prices = {}

        for ingredient in ingredients:
            response = requests.get(
                f"{product_url}?filter.term={ingredient}&filter.limit=1",
                headers=headers
            )
            data = response.json()
            prices[ingredient] = data.get("data", [{}])[0].get("price", {}).get("regular", "Not Found")

        return prices

    return {"error": f"{store} not supported yet"}
