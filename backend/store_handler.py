import requests
import base64

class KrogerAPI:
    def __init__(self, client_id, client_secret):
        """
        Initializes the KrogerAPI class with client credentials.
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        self.base_url = "https://api-ce.kroger.com/v1"

    def get_encoded_credentials(self):
        """
        This step is required for OAuth2 authentication.
        """
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        return encoded_credentials

    def request_token(self):
        """
        Requests an OAuth2 access token using client credentials.
        """
        url = f"{self.base_url}/connect/oauth2/token"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {self.get_encoded_credentials()}"
        }
        data = {
            "grant_type": "client_credentials",
            "scope": "product.compact profile.compact"
        }

        response = requests.post(url, headers=headers, data=data)

        if response.status_code == 200:
            self.access_token = response.json().get("access_token", "")
            return self.access_token
        else:
            print(f"Error: {response.status_code}, {response.text}")
            return None

    def get_kroger_stores(self, zip_code, limit=10):
        """
        Fetches Kroger stores near a given ZIP code.
        
        :param zip_code: ZIP code to search stores near
        :param limit: Number of stores to fetch (default: 10)
        :return: List of store details
        """
        if not self.access_token:
            print("Error: No access token available. Request one first.")
            return []

        url = f"{self.base_url}/locations"
        params = {
            "filter.zipCode.near": zip_code,
            "filter.limit": limit
        }
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }

        response = requests.get(url, headers=headers, params=params)

        if response.status_code == 200:
            data = response.json()
            stores = [
                {
                    "id": store.get("locationId"),
                    "name": store.get("name", "Unknown Store"),
                    "address": store["address"].get("addressLine1", "Unknown Address"),
                    "city": store["address"].get("city", ""),
                    "state": store["address"].get("state", ""),
                    "zip": store["address"].get("zipCode", ""),
                }
                for store in data.get("data", [])
            ]
            return stores
        else:
            print(f"Error: {response.status_code}, {response.text}")
            return []

    def search_products(self, search_terms, location_id=None, limit=10, start=0):
        """
        Searches for one or multiple products in the Kroger catalog with pagination.
        
        :param search_terms: A single item or comma-separated items (e.g., "milk" or "bread, eggs, cheese")
        :param location_id: Optional location ID to get store-specific prices, inventory, and aisle info
        :param limit: Number of results per item to fetch (default: 10)
        :param start: Number of results to skip (pagination support)
        :return: List of product details
        """
        if not self.access_token:
            print("Error: No access token available. Request one first.")
            return []

        url = f"{self.base_url}/products"
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }

        search_items = [item.strip() for item in search_terms.split(",")]
        all_results = []

        for item in search_items:
            params = {
                "filter.term": item,
                "filter.limit": limit,
                "filter.start": start
            }

            # If location_id is provided, fetch store-specific details
            if location_id:
                params["filter.locationId"] = location_id

            response = requests.get(url, headers=headers, params=params)

            if response.status_code == 200:
                data = response.json()
                products = [
                    {
                        "name": product.get("description", "Unknown Product"),
                        "brand": product.get("brand", "Unknown Brand"),
                        "size": product.get("size", "Unknown Size"),
                        "UPC": product.get("upc", "Unknown UPC"),
                        "price": product.get("items", [{}])[0].get("price", {}).get("regular", "N/A"),
                        "aisle": product.get("items", [{}])[0].get("aisleLocations", [{}])[0].get("number", "Unknown"),
                        "inventory": product.get("items", [{}])[0].get("inventory", {}).get("stockLevel", "N/A"),
                        "fulfillment": {
                            "instore": product.get("items", [{}])[0].get("fulfillment", {}).get("instore", False),
                            "shiptohome": product.get("items", [{}])[0].get("fulfillment", {}).get("shipToHome", False),
                            "delivery": product.get("items", [{}])[0].get("fulfillment", {}).get("delivery", False),
                            "curbside": product.get("items", [{}])[0].get("fulfillment", {}).get("curbside", False),
                        }
                    }
                    for product in data.get("data", [])
                ]
                all_results.extend(products)
            else:
                print(f"Error fetching {item}: {response.status_code}, {response.text}")

        return all_results

# Example Usage:
if __name__ == "__main__":
    CLIENT_ID = "nutrify-2432612430342445574c6e2f4174746941377459497376313952524f754958446f585241614a675677526d5646354f547a71502f4631365747572e4b1774410088019709705"
    CLIENT_SECRET = "QkJnE0XrFDHIl1Y2BH9H1lFp96BYHU24fFfA2ZTL"
    

    kroger_api = KrogerAPI(CLIENT_ID, CLIENT_SECRET)
    access_token = kroger_api.request_token()

    if access_token:
        # Search for a nearby store first
        stores = kroger_api.get_kroger_stores(zip_code="97401", limit=1) #we can do like no limit and choose the store with the most stock or the closest

        # stores = kroger_api.get_kroger_stores(zip_code="97401", limit=10)
        # print(stores)
        #If you want to test all the stores in the area uncomment the lines above
        
        store_id = stores[0]["id"] if stores else None

        # search is pretty simple
        items_to_search = "steak"
        products = kroger_api.search_products(items_to_search, location_id=store_id, limit=5, start=0)

        for product in products:
            print(f"{product['name']} - {product['brand']} - {product['size']} - Price: ${product['price']} - UPC: {product['UPC']}")
            print(f"Aisle: {product['aisle']}, Inventory: {product['inventory']}")
            print(f"Available for: {'In-store' if product['fulfillment']['instore'] else 'N/A'}, "
                  f"{'Delivery' if product['fulfillment']['delivery'] else 'N/A'}, "
                  f"{'Curbside' if product['fulfillment']['curbside'] else 'N/A'}, "
                  f"{'Ship-to-home' if product['fulfillment']['shiptohome'] else 'N/A'}")
            print("----")
