import pytest
import sqlite3
from contextlib import closing
from data import Database, format_recipe_string

@pytest.fixture
def db():
    """Fixture to set up a temporary database."""
    with Database(db_name=':memory:') as db:
        yield db

def test_insert_recipe(db):
    """Test inserting a recipe."""
    ingredients = [("Sugar", "100g"), ("Flour", "200g"), ("Cocoa powder", "50g")]
    link = "https://example.com/chocolate-cake"
    recipe_string = format_recipe_string(ingredients, link)

    db.insert_recipe('Chocolate Cake', link, recipe_string)

    # Fetch the recipe by ID and check if it was inserted correctly
    recipe = db.get_recipe_by_id(1)
    assert recipe is not None
    assert recipe[1] == 'Chocolate Cake'
    assert recipe[2] == link
    assert recipe[3] == recipe_string

def test_get_all_recipes(db):
    """Test fetching all recipes."""
    ingredients1 = [("Sugar", "100g"), ("Flour", "200g"), ("Cocoa powder", "50g")]
    link1 = "https://example.com/chocolate-cake"
    recipe_string1 = format_recipe_string(ingredients1, link1)
    
    ingredients2 = [("Butter", "100g"), ("Eggs", "2 large"), ("Baking powder", "1 tsp")]
    link2 = "https://example.com/vanilla-cake"
    recipe_string2 = format_recipe_string(ingredients2, link2)
    
    db.insert_recipe('Chocolate Cake', link1, recipe_string1)
    db.insert_recipe('Vanilla Cake', link2, recipe_string2)

    recipes = db.get_all_recipes()
    assert len(recipes) == 2
    assert recipes[0][1] == 'Chocolate Cake'
    assert recipes[1][1] == 'Vanilla Cake'

def test_update_recipe(db):
    """Test updating an existing recipe."""
    ingredients1 = [("Sugar", "100g"), ("Flour", "200g"), ("Cocoa powder", "50g")]
    link1 = "https://example.com/chocolate-cake"
    recipe_string1 = format_recipe_string(ingredients1, link1)
    
    # Insert a recipe
    db.insert_recipe('Chocolate Cake', link1, recipe_string1)

    # Update the recipe
    ingredients2 = [("Butter", "100g"), ("Eggs", "2 large"), ("Baking powder", "1 tsp")]
    link2 = "https://example.com/updated-chocolate-cake"
    updated_recipe_string = format_recipe_string(ingredients2, link2)
    db.update_recipe(1, 'Updated Chocolate Cake', link2, updated_recipe_string)

    # Fetch the updated recipe and check its contents
    recipe = db.get_recipe_by_id(1)
    assert recipe is not None
    assert recipe[1] == 'Updated Chocolate Cake'
    assert recipe[2] == link2
    assert recipe[3] == updated_recipe_string

def test_delete_recipe(db):
    """Test deleting a recipe."""
    ingredients1 = [("Sugar", "100g"), ("Flour", "200g"), ("Cocoa powder", "50g")]
    link1 = "https://example.com/chocolate-cake"
    recipe_string1 = format_recipe_string(ingredients1, link1)

    # Insert a recipe
    db.insert_recipe('Chocolate Cake', link1, recipe_string1)

    # Delete the recipe
    db.delete_recipe(1)

    # Try to fetch the deleted recipe and ensure it doesn't exist
    recipe = db.get_recipe_by_id(1)
    assert recipe is None

def test_get_non_existent_recipe(db):
    """Test getting a non-existent recipe."""
    recipe = db.get_recipe_by_id(999)  # Assuming this ID doesn't exist
    assert recipe is None
