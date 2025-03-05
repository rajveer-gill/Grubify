import base64
import requests
from flask import Flask, request, redirect

app = Flask(__name__)

# -----------------------------------------------------------------------
# 1) Your Kroger Dev Portal credentials for PRODUCTION environment
# -----------------------------------------------------------------------
CLIENT_ID = "nutrifai-243261243034242e644175722e4a4c397a4e507a454732506e594e366576617532756c356b4741754c48746c31634a59564b784d4f2e364e7743462e3423701595089688646"
CLIENT_SECRET = "f8IG7k0gYTJZNfHM9a22vaP0_ytGIYng2Acr9mIu"
REDIRECT_URI = "http://127.0.0.1:5000/callback"

# Kroger's PRODUCTION endpoints (use api.kroger.com):
AUTH_URL = "https://api.kroger.com/v1/connect/oauth2/authorize"
TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token"
CART_ADD_URL = "https://api.kroger.com/v1/cart/add"

# -----------------------------------------------------------------------
# 2) Home route: Simple landing page
# -----------------------------------------------------------------------
@app.route("/")
def home():
    return """
    <h1>Welcome to NutrifyCart (PRODUCTION)!</h1>
    <p>This demo uses Kroger's Authorization Code flow in the Production environment.</p>
    <p><a href='/login'>Log in with Kroger (cart.basic:write)</a></p>
    """

# -----------------------------------------------------------------------
# 3) /login route: Start the OAuth2 Authorization Code flow
# -----------------------------------------------------------------------
@app.route("/login")
def login():
    """
    Redirect the user to Kroger's OAuth2 authorization endpoint
    requesting the cart.basic:write scope (for modifying a cart).
    """
    scope = "cart.basic:write"
    authorize_url = (
        f"{AUTH_URL}?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={scope}"
    )
    return redirect(authorize_url)

# -----------------------------------------------------------------------
# 4) /callback route: Kroger redirects here after user login
# -----------------------------------------------------------------------
@app.route("/callback")
def callback():
    """
    Kroger will redirect to this route with ?code=XXXX in the URL.
    We exchange that code for a user-level token, then demonstrate
    adding an item to the cart in the Production environment.
    """
    auth_code = request.args.get("code", None)
    if not auth_code:
        return "No code provided by Kroger. Check if user canceled or if there's an error."

    # Exchange auth_code for an actual user token
    user_token = exchange_code_for_token(auth_code)

    if not user_token:
        return "Failed to get user token from Kroger."

    # If we got a user token, let's add an item to their cart as a demo:
    success = add_item_to_cart(user_token, upc="0001111019270", quantity=1, modality="PICKUP")
    if success:
        return """
        <h2>Successfully added an item to your Kroger cart (Production)!</h2>
        <p>Check your Kroger account or app to confirm.</p>
        """
    else:
        return "Failed to add item to cart (check console for details)."

# -----------------------------------------------------------------------
# 5) Helper: Exchange the authorization code for a user-level token
# -----------------------------------------------------------------------
def exchange_code_for_token(auth_code):
    """
    Calls /v1/connect/oauth2/token with grant_type=authorization_code
    to obtain a user-level token for the scope(s) we requested.
    """
    creds = f"{CLIENT_ID}:{CLIENT_SECRET}"
    encoded_creds = base64.b64encode(creds.encode()).decode()

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encoded_creds}"
    }
    data = {
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": REDIRECT_URI,
        "scope": "cart.basic:write"
    }

    response = requests.post(TOKEN_URL, headers=headers, data=data)
    if response.status_code == 200:
        token_data = response.json()
        return token_data.get("access_token")
    else:
        print("Token exchange failed:", response.status_code, response.text)
        return None

# -----------------------------------------------------------------------
# 6) Helper: Add an item to the cart using the user token (Production)
# -----------------------------------------------------------------------
def add_item_to_cart(user_token, upc, quantity, modality="PICKUP"):
    """
    Calls the Kroger Cart API to add an item to the user's cart (Production).
    This requires a valid user-token (with cart.basic:write scope).
    """
    headers = {
        "Authorization": f"Bearer {user_token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "items": [
            {
                "upc": upc,
                "quantity": quantity,
                "modality": modality
            }
        ]
    }

    response = requests.put(CART_ADD_URL, headers=headers, json=payload)
    if response.status_code in [200, 201, 204]:
        print("Successfully added item to cart in Production!")
        return True
    else:
        print("Error adding item to cart:", response.status_code, response.text)
        return False

# -----------------------------------------------------------------------
# 7) Run the Flask app
# -----------------------------------------------------------------------
if __name__ == "__main__":
    # For local testing only. 
    # Visit http://127.0.0.1:5000/ in your browser to start.
    app.run(port=5000, debug=True)

