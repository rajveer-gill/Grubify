import sqlite3

class Database:
    def __init__(self, db_name='data.db'):
        """
        Initialize the Database connection and cursor.
        """
        self.connection = sqlite3.connect('data')
        self.crsr = self.connection.cursor()
        create_table_sql = '''
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            recipe_string TEXT NOT NULL
        );
        '''
        self.crsr.execute(create_table_sql)
        self.connection.commit()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        # Close the connection when done
        self.connection.close()

    def insert_recipe(self, title, link, recipe_string):
        """
        Insert a new recipe into the database
        """
        sql_command = '''
        INSERT INTO recipes (title, link, recipe_string) 
        VALUES (?, ?, ?);
        '''
        self.crsr.execute(sql_command, (title, link, recipe_string))
        self.connection.commit()

    def get_recipe_by_id(self, recipe_id):
        """
        Get a recipe by its ID.
        """
        sql_command = 'SELECT * FROM recipes WHERE id = ?;'
        self.crsr.execute(sql_command, (recipe_id,))
        return self.crsr.fetchone()  # Returns a tuple (id, title, link, recipe_string)

    def get_all_recipes(self):
        """
        Get all recipes in the database.
        """
        sql_command = 'SELECT * FROM recipes;'
        self.crsr.execute(sql_command)
        return self.crsr.fetchall()  # Returns a list of tuples (id, title, link, recipe_string)

    def delete_recipe(self, recipe_id):
        """
        Delete a recipe by its ID.
        """
        sql_command = 'DELETE FROM recipes WHERE id = ?;'
        self.crsr.execute(sql_command, (recipe_id,))
        self.connection.commit()

    def update_recipe(self, recipe_id, title, link, recipe_string):
        """
        Update an existing recipe.
        """
        sql_command = '''
        UPDATE recipes 
        SET title = ?, link = ?, recipe_string = ? 
        WHERE id = ?;
        '''
        self.crsr.execute(sql_command, (title, link, recipe_string, recipe_id))
        self.connection.commit()


def main():
    print("Starting the Recipe Database")

    # Create a Database instance
    with Database() as db:
        # Insert a new recipe
        db.insert_recipe('Chocolate Cake', 'test_link.com', 'Ingredients: sugar, flour, cocoa...')
        
        # Retrieve and print a specific recipe by ID
        recipe = db.get_recipe_by_id(1)
        print("Recipe fetched by ID:", recipe)
        
        # Get and print all recipes
        recipes = db.get_all_recipes()
        print("All Recipes:", recipes)
        
        # Update a recipe
        db.update_recipe(1, 'Updated Chocolate Cake', 'test_link2.com', 'Updated ingredients list...')
        
        # Delete a recipe
        db.delete_recipe(1)

if __name__ == "__main__":
    main()
