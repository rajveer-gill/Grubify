# recipe_handler.py
import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()

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
    # Use the new library approach for openai>=1.0.0
    openai.api_key = "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"

    # Provide GPT a system prompt describing exactly the JSON format we need:
    system_prompt = (
        "You are an AI chef. Return a JSON object with this structure:\n\n"
        "{\n"
        '  "name": "string",\n'
        '  "ingredients": [ {"name": "string", "amount": "string"}, ... ],\n'
        '  "instructions": ["step1", "step2", ...]\n'
        "}\n\n"
        "No extra keys, no markdown. If unsure, make a best guess."
    )

    user_prompt = f"Generate a recipe for: {description}"

    response = openai.chat.completions.create(
        model="gpt-4",  # or "gpt-3.5-turbo" if you prefer
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.7
    )

    # GPT's raw text
    raw_content = response.choices[0].message.content.strip()

    # Parse the JSON GPT returned
    try:
        recipe_data = json.loads(raw_content)
    except json.JSONDecodeError:
        # If GPT didn't return valid JSON, fallback to a sample
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

    # Wrap it under "structured_recipe" so your frontend can do data.structured_recipe
    return {"structured_recipe": recipe_data}
