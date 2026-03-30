# recipe_handler.py
import json
import os

import openai
from dotenv import load_dotenv

from recipe_schema import RECIPE_SYSTEM_JSON_RULES, normalize_recipe_dict

load_dotenv()

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def fetch_recipe(description):
    """
    Calls OpenAI to generate a recipe with structured JSON including
    krogerSearchQuery per ingredient for grocery search.
    """
    system_prompt = (
        "You are an AI chef. " + RECIPE_SYSTEM_JSON_RULES + " "
        "Example ingredient: "
        '{"name": "Unsalted butter", "amount": "1/2 cup", "krogerSearchQuery": "unsalted butter"}'
    )

    user_prompt = f"Generate a recipe for: {description}"

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        raw_content = response.choices[0].message.content.strip()
        recipe_data = json.loads(raw_content)
        recipe_data = normalize_recipe_dict(recipe_data)

    except (json.JSONDecodeError, AttributeError, TypeError, KeyError) as e:
        print(f"fetch_recipe fallback after: {e}")
        recipe_data = {
            "name": "Fallback Dish",
            "ingredients": [
                {
                    "name": "Ingredient 1",
                    "amount": "1 cup",
                    "krogerSearchQuery": "ingredient",
                }
            ],
            "instructions": ["Step 1: Fallback", "Step 2: Fallback"],
        }

    return {"structured_recipe": recipe_data}
