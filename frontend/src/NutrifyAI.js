import React, { useState } from 'react';
import { MessageCircle, Compass, ChevronDown, Info, User, ShoppingCart, ArrowLeft, Search, Save, X, Check, Send } from 'lucide-react';
import './NutrifyAI.css';

const NutrifyAI = () => {
  const [inputValue, setInputValue] = useState('');
  const [currentView, setCurrentView] = useState('input'); // 'input', 'details', or 'pastRecipes'
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [modificationLoading, setModificationLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  
  // Sample recipe data as fallback
  const sampleRecipe = {
    name: "Mediterranean Quinoa Bowl",
    ingredients: [
      { name: "Quinoa", amount: "1 cup", inPantry: true },
      { name: "Cherry Tomatoes", amount: "1 cup, halved", inPantry: false },
      { name: "Cucumber", amount: "1/2, diced", inPantry: true },
      { name: "Kalamata Olives", amount: "1/4 cup, sliced", inPantry: false },
      { name: "Feta Cheese", amount: "1/2 cup, crumbled", inPantry: false },
      { name: "Olive Oil", amount: "2 tbsp", inPantry: true },
      { name: "Lemon Juice", amount: "1 tbsp", inPantry: true },
      { name: "Fresh Mint", amount: "2 tbsp, chopped", inPantry: false }
    ],
    instructions: [
      "Cook quinoa according to package directions and let cool.",
      "Combine all ingredients in a large bowl.",
      "Drizzle with olive oil and lemon juice.",
      "Toss gently to combine and serve."
    ]
  };
  
  // The base URL for the API
  const API_URL = 'http://127.0.0.1:5000';
  
  // Function to fetch recipe from our Python backend
  const fetchRecipeFromAPI = async (description) => {
    try {
      const response = await fetch(`${API_URL}/generate-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch recipe');
      }
      
      const data = await response.json();
      
      // The API now returns both raw text and structured recipe
      return data.structured_recipe;
    } catch (error) {
      console.error('Error fetching recipe:', error);
      throw error;
    }
  };
  
  // Function to modify existing recipe through the API
  const modifyRecipeFromAPI = async (originalRecipe, modifications) => {
    try {
      const response = await fetch(`${API_URL}/modify-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          original_recipe: originalRecipe,
          modifications: modifications 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to modify recipe');
      }
      
      const data = await response.json();
      return data.modified_recipe;
    } catch (error) {
      console.error('Error modifying recipe:', error);
      throw error;
    }
  };
  
  // Function to fetch prices for ingredients
  const fetchIngredientPrices = async (ingredients, store = 'kroger') => {
    try {
      const response = await fetch(`${API_URL}/fetch-prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ingredients: ingredients.map(ing => ing.name),
          store 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching prices:', error);
      return null;
    }
  };
  
  // Function to add items to cart
  const addItemsToCart = async (items, store = 'kroger') => {
    try {
      const response = await fetch(`${API_URL}/add-to-cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items, store }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to add items to cart');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding to cart:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Handle recipe submission with API call
  const handleSubmitRecipe = async () => {
    if (inputValue.trim() === '') return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Call our Python backend API
      const recipe = await fetchRecipeFromAPI(inputValue);
      
      // Add pantry status to ingredients (randomly for demo)
      const recipeWithPantry = {
        ...recipe,
        ingredients: recipe.ingredients.map(ingredient => ({
          ...ingredient,
          /*inPantry: Math.random() > 0.6, // Random true/false, weighted toward false*/
          confirmed: true,
        })),
      };
      
      setCurrentRecipe(recipeWithPantry);
      setCurrentView('details');
    } catch (error) {
      console.error("Error getting recipe:", error);
      setError("Failed to fetch recipe. Using sample recipe instead.");
      
      // Fallback to sample recipe
      setCurrentRecipe({
        ...sampleRecipe,
        ingredients: sampleRecipe.ingredients.map(ingredient => ({
          ...ingredient,
          confirmed: false
        }))
      });
      setCurrentView('details');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle sending a recipe modification request
  const handleRecipeModification = async () => {
    if (chatInput.trim() === '') return;
    
    setModificationLoading(true);
    
    // Add user message to chat history
    const newMessage = { 
      text: chatInput, 
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setChatHistory(prevHistory => [...prevHistory, newMessage]);
    setChatInput('');
    
    try {
      // Call the API to modify the recipe
      const modifiedRecipe = await modifyRecipeFromAPI(currentRecipe, chatInput);
      
      // Keep pantry status and confirmation status for ingredients that exist in both recipes
      const updatedRecipe = {
        ...modifiedRecipe,
        ingredients: modifiedRecipe.ingredients.map(newIngredient => {
          // Try to find this ingredient in the current recipe
          const existingIngredient = currentRecipe.ingredients.find(
            ing => ing.name.toLowerCase() === newIngredient.name.toLowerCase()
          );
          
          return {
            ...newIngredient,
            inPantry: existingIngredient ? existingIngredient.inPantry : Math.random() > 0.6,
            confirmed: existingIngredient ? existingIngredient.confirmed : false
          };
        })
      };
      
      // Add system response to chat history
      setChatHistory(prevHistory => [
        ...prevHistory, 
        { 
          text: `Recipe updated: "${modifiedRecipe.name}"`, 
          sender: 'system',
          timestamp: new Date().toISOString()
        }
      ]);
      
      setCurrentRecipe(updatedRecipe);
    } catch (error) {
      console.error("Error modifying recipe:", error);
      
      // Add error message to chat history
      setChatHistory(prevHistory => [
        ...prevHistory, 
        { 
          text: "Sorry, I couldn't modify the recipe. Please try a different request.", 
          sender: 'system',
          timestamp: new Date().toISOString(),
          isError: true
        }
      ]);
    } finally {
      setModificationLoading(false);
    }
  };
  
  // Handle removing an ingredient
  const handleRemoveIngredient = (indexToRemove) => {
    const updatedRecipe = {...currentRecipe};
    updatedRecipe.ingredients = updatedRecipe.ingredients.filter((_, index) => index !== indexToRemove);
    setCurrentRecipe(updatedRecipe);
  };
  
  // Handle confirming an ingredient
  const handleConfirmIngredient = (index) => {
    const updatedRecipe = {...currentRecipe};
    updatedRecipe.ingredients[index].confirmed = !updatedRecipe.ingredients[index].confirmed;
    setCurrentRecipe(updatedRecipe);
  };
  
  // Handle ordering with Kroger
  const handleOrderWithKroger = async () => {
    const confirmedIngredients = currentRecipe.ingredients
      .filter(ing => ing.confirmed && !ing.inPantry)
      .map(ing => ing.name);
    
    if (confirmedIngredients.length === 0) {
      alert("Please confirm at least one ingredient to order");
      return;
    }
    
    setLoading(true);
    try {
      const result = await addItemsToCart(confirmedIngredients, 'kroger');
      
      if (result.success) {
        alert(`Added to Kroger cart: ${confirmedIngredients.join(', ')}`);
      } else {
        alert(`Failed to add to Kroger cart: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error adding to Kroger cart: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="nutrify-container">
      {/* Simplified sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <MessageCircle size={16} />
          </div>
          <span className="logo-text">Nutrify AI</span>
          <ChevronDown className="dropdown-icon" size={16} />
        </div>
        
        {/* Navigation menu - simplified to only Past Recipes */}
        <div className="nav-menu">
          <button 
            className="nav-item"
            onClick={() => setCurrentView('pastRecipes')}
          >
            <Compass size={16} />
            <span>Past Recipes</span>
          </button>
        </div>
        
        {/* History sections */}
        <div className="history-container">
          <h3 className="history-title">Previous 30 Days</h3>
          <button className="history-item">
            Grilled Salmon with Asparagus
          </button>
          <button className="history-item">
            Mediterranean Chicken Bowl
          </button>
          <button className="history-item">
            Quinoa Vegetable Stir-Fry
          </button>
          <button className="history-item">
            Avocado Toast with Poached Eggs
          </button>
          
          <div className="divider"></div>
          
          <h3 className="history-title">January</h3>
          <button className="history-item">
            Healthy Breakfast Ideas
          </button>
          <button className="history-item">
            Low-carb Dinner Recipes
          </button>
          <button className="history-item">
            Vitamin Deficiency Symptoms
          </button>
          <button className="history-item">
            Calorie Tracking Tips
          </button>
        </div>
        
        {/* Upgrade button */}
        <div className="sidebar-footer">
          <button 
            className="upgrade-button"
            onClick={() => window.open("http://127.0.0.1:5000/login", "_blank")}
          >
            <Info size={16} />
            <span>Login with Kroger</span>
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Profile icon in top-right */}
        <div className="profile-container">
          <button 
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <User size={20} />
          </button>
          
          {/* Profile dropdown */}
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <span>John Doe</span>
                <span className="profile-email">john.doe@example.com</span>
              </div>
              <div className="profile-section">
                <button className="profile-option">Profile Settings</button>
                <button className="profile-option">Order History</button>
                <button className="profile-option">Saved Recipes</button>
                <button className="profile-option">My Pantry</button>
                <button className="profile-option">Sign Out</button>
              </div>
            </div>
          )}
        </div>
        
        {/* Recipe Input View */}
        {currentView === 'input' && (
          <div className="chat-area">
            <h1 className="main-heading">What would you like to cook today?</h1>
            <div className="center-query-container">
              <div className="center-input-wrapper">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter a recipe or dish you want to make..."
                  className="center-text-input"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) handleSubmitRecipe();
                  }}
                />
                <div className="center-input-buttons">
                  <button 
                    className="icon-button"
                    onClick={handleSubmitRecipe}
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="loading-spinner"></div>
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                  {/* Removed microphone button */}
                </div>
              </div>
              
              {/* Loading message */}
              {loading && (
                <div className="loading-message">
                  Generating your recipe with AI... This may take a moment.
                </div>
              )}
              
              {/* Error message */}
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              
              {/* Disclaimer */}
              <div className="disclaimer-container">
                <div className="disclaimer">
                  Nutrify AI helps you find recipes and purchase ingredients from grocery delivery services. Always check for allergens and nutritional information.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Recipe Details View (second screen) */}
        {currentView === 'details' && currentRecipe && (
          <div className="recipe-details">
            <button 
              className="back-button"
              onClick={() => setCurrentView('input')}
            >
              <ArrowLeft size={16} />
              <span>Back to Search</span>
            </button>
            
            <h1 className="recipe-title">{currentRecipe.name}</h1>
            
            <div className="recipe-content">
              <div className="ingredients-section">
                <h2>Ingredients</h2>
                
                <div className="ingredients-list">
                  {currentRecipe.ingredients.map((ingredient, index) => (
                    <div 
                      key={index} 
                      className={`ingredient-item ${ingredient.confirmed ? 'confirmed' : 'unconfirmed'}`}
                    >
                      <span className="ingredient-name">{ingredient.name}</span>
                      <span className="ingredient-amount">{ingredient.amount}</span>
                      <span className="ingredient-status"></span>
                      
                      <div className="ingredient-actions">
                        <button 
                          className={`confirm-button ${ingredient.confirmed ? 'confirmed' : ''}`}
                          onClick={() => handleConfirmIngredient(index)}
                          title={ingredient.confirmed ? "Unconfirm" : "Confirm"}
                        >
                          <Check size={16} />
                        </button>
                        
                        {/*<button 
                          className="remove-button"
                          onClick={() => handleRemoveIngredient(index)}
                          title="Remove"
                        >
                          <X size={16} />
                        </button>*/}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="missing-ingredients">
                  <h3>Ingredients to Purchase</h3>
                  <p>
                    {currentRecipe.ingredients.filter(i => !i.inPantry).length} items needed 
                    ({currentRecipe.ingredients.filter(i => !i.inPantry && i.confirmed).length} confirmed)
                  </p>
                  
                  <div className="grocery-options">
                    <button 
                      className="grocery-button kroger"
                      onClick={handleOrderWithKroger}
                      disabled={loading || currentRecipe.ingredients.filter(i => !i.inPantry && i.confirmed).length === 0}
                    >
                      <ShoppingCart size={16} />
                      <span>Order with Kroger</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="instructions-section">
                <h2>Instructions</h2>
                <ol className="instructions-list">
                  {currentRecipe.instructions.map((step, index) => (
                    <li key={index} className="instruction-step">
                      {step}
                    </li>
                  ))}
                </ol>
                
                <button className="save-recipe-button">
                  <Save size={16} />
                  <span>Save to My Recipes</span>
                </button>
                
                {/* Recipe Modification Chat */}
                <div className="recipe-chat-container">
                  <h3>Modify Recipe</h3>
                  <p className="chat-help-text">
                    Need adjustments? Ask me to make it spicier, add more protein, make it vegan, etc.
                  </p>
                  
                  {/* Chat History */}
                  {chatHistory.length > 0 && (
                    <div className="chat-history">
                      {chatHistory.map((message, index) => (
                        <div 
                          key={index} 
                          className={`chat-message ${message.sender} ${message.isError ? 'error' : ''}`}
                        >
                          {message.text}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Chat Input */}
                  <div className="chat-input-container">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="How would you like to modify this recipe?"
                      className="chat-input"
                      disabled={modificationLoading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !modificationLoading) handleRecipeModification();
                      }}
                    />
                    <button 
                      className="chat-send-button"
                      onClick={handleRecipeModification}
                      disabled={modificationLoading || chatInput.trim() === ''}
                    >
                      {modificationLoading ? (
                        <div className="chat-loading-spinner"></div>
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Past Recipes View */}
        {currentView === 'pastRecipes' && (
          <div className="past-recipes">
            <button 
              className="back-button"
              onClick={() => setCurrentView('input')}
            >
              <ArrowLeft size={16} />
              <span>Back to Search</span>
            </button>
            
            <h1 className="past-recipes-title">Your Recipe History</h1>
            
            <div className="recipe-history-grid">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="recipe-card">
                  <div className="recipe-card-header">
                    <h3>Mediterranean Quinoa Bowl</h3>
                    <span className="recipe-date">Feb 12, 2023</span>
                  </div>
                  <p className="recipe-description">
                    A refreshing Mediterranean-inspired bowl with quinoa, vegetables, and feta.
                  </p>
                  <div className="recipe-card-actions">
                    <button 
                      className="card-action-button"
                      onClick={() => {
                        setCurrentRecipe({
                          ...sampleRecipe,
                          ingredients: sampleRecipe.ingredients.map(ingredient => ({
                            ...ingredient,
                            confirmed: false
                          }))
                        });
                        setCurrentView('details');
                      }}
                    >
                      View Recipe
                    </button>
                    <button 
                      className="card-action-button"
                      onClick={() => {
                        setCurrentRecipe({
                          ...sampleRecipe,
                          ingredients: sampleRecipe.ingredients.map(ingredient => ({
                            ...ingredient,
                            confirmed: !ingredient.inPantry
                          }))
                        });
                        setCurrentView('details');
                      }}
                    >
                      Reorder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NutrifyAI;