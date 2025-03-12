# System Structure

```mermaid
graph TD
    %% Frontend Components
    subgraph Frontend
        NutrifyAI_js[NutrifyAI.js]
        NutrifyAI_css[NutrifyAI.css]
    end

    %% Backend Components
    subgraph Backend
        app[app.py]
        recipe_handler[recipe_handler.py]
        store_handler[store_handler.py]
        user[user.py]
        data[data.py]
        db[(Database)]
    end

    %% Dependencies and Relationships
    NutrifyAI_js -->|API Calls| app
    NutrifyAI_js -->|Styling| NutrifyAI_css
    
    recipe_handler -->|fetch_recipe| app
    store_handler -->|fetch_ingredient_prices| app
    user -->|exchange_code_for_token| app
    user -->|add_item_to_cart| app
    data -->|Database| app
    data <-->|interacts with| db

    classDef frontend fill:#f9d6d2,stroke:#f25a41,stroke-width:2px;
    classDef backend fill:#d2f9d6,stroke:#41f25a,stroke-width:2px;
    classDef database fill:#d2d6f9,stroke:#4159f2,stroke-width:2px;
    
    class NutrifyAI_js,NutrifyAI_css frontend;
    class app,recipe_handler,store_handler,user,data backend;
    class db database;
```
The system is composed of a front end and back end. The front end consists of NutrifyAI.js and NutrifyAI.css. These provide the visual layout of the program and the UI the user uses to interact with the backend functions. The backend consists of a python file app.y which uses classes from files recipe_handler.py, store_handler.py, user.py, and data.py. The front end javascript uses API calls to call functions from the backend such as save-data which puts the current recipe into the database.

### Nutrify.js
- /get-past: calls the python database class to returns all recipes stored in the database in json form
- /generate-recipe: calls the python recipe_handler to generate a recipe
- /modify-recipe: calls the python recipe_handler to make changes to the current recipe if the user requests
- /fetch-prices: calls store_handler to get prices (not included in final product)
- /add-to-cart: calls cart_handler to add the current list of ingredients to the Kroger cart
- /save-recipe: calls the python database class to save the current recipe in json form to the database
