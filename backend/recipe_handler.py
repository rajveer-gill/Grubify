# recipe_handler.py
import os
import json
import openai
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client with your API key from .env
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def fetch_recipe(description):
    """
    Calls GPT-4 to generate a recipe in a JSON structure:
    {
      "structured_recipe": {
        "name": "...",
        "ingredients": [
          {"name": "...", "amount": "..."},
          ...
        ],
        "instructions": [
          "...",
          ...
        ]
      }
    }
    """
    system_prompt = (
        "You are an AI chef. Return a JSON object with this structure:\n\n"
        "{\n"
        '  "name": "string",\n'
        '  "ingredients": [ {"name": "string", "amount": "string"} ],\n'
        '  "instructions": ["step1", "step2"]\n'
        "}\n\n"
        "No extra keys, no markdown. If unsure, make a best guess."
    )

    user_prompt = f"Generate a recipe for: {description}"

    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Or use "gpt-3.5-turbo" for lower cost
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7
        )

        raw_content = response.choices[0].message.content.strip()
        recipe_data = json.loads(raw_content)

    except (json.JSONDecodeError, AttributeError):
        # Fallback if the response isn't valid JSON
        recipe_data = {
            "name": "Fallback Dish",
            "ingredients": [
                {"name": "Ingredient 1", "amount": "1 cup"}
            ],
            "instructions": [
                "Step 1: Fallback",
                "Step 2: Fallback"
            ]
        }

    return {"structured_recipe": recipe_data}
