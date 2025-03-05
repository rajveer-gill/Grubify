import sqlite3

class Database:
    def __init__(self, db_name='data.db'):
        """
        Initialize the Database connection and cursor.
        """
        self.connection = sqlite3.connect(db_name)
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
        Insert a new recipe into the database.
        recipe_string should be in the format given by format_recipe_string
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

def format_recipe_string(ingredients, link):
    """
    Convert a list of ingredients and amounts into a string format.
    Ingredients should be a list of tuples like: [("ingredient1", "amount1"), ("ingredient2", "amount2")]
    """
    recipe_string = ""
    for ingredient, amount in ingredients:
        recipe_string += f"{ingredient} {amount}\n"
    recipe_string += f"Link: {link}"
    return recipe_string

