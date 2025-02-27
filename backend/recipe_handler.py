import openai
import os
from dotenv import load_dotenv

load_dotenv()

def fetch_recipe(description):
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an AI chef that generates recipes."},
            {"role": "user", "content": description}
        ]
    )

    return response.choices[0].message.content
