import React, { useState, useEffect } from 'react';
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { useAuth } from "./hooks/useAuth";
import Modal from 'react-modal';
import toast from 'react-hot-toast';
import { db } from './firebase'; // already good
import { collection, addDoc, getDocs, getDocsFromCache } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  MessageCircle,
  Compass,
  ChevronDown,
  Info,
  User,
  ShoppingCart,
  ArrowLeft,
  Search,
  Save,
  X,
  Check,
  Send
} from 'lucide-react';
import './NutrifyAI.css';

Modal.setAppElement('#root');


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
  const [cartStatus, setCartStatus] = useState(null); // State for cart overlay status
  const [recipeSaving, setRecipeSaving] = useState(false); // State to track save recipe operation
  const [pastRecipes, setPastRecipes] = useState([]); // NEW state for past recipes
  const [pastRecipesLoading, setPastRecipesLoading] = useState(false); // NEW state for loading indicator
  const [krogerSignInAuthed, setKrogerSignInAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [store, setStore] = useState("kroger");
  const user = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (user && isModalOpen) {
      setIsModalOpen(false);
    }
  }, [user, isModalOpen]);
  

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      toast.success('Signed in successfully!');
    } catch (err) {
      toast.error('Login failed.');
      console.error("Login failed:", err);
    }
  };
  
  const handleEmailLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error('Email login failed.');
      console.error(err);
    }
  };
  
  const handleEmailSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success('Account created!');
    } catch (err) {
      toast.error('Signup failed.');
      console.error(err);
    }
  };

  const handleSaveRecipe = async () => {
    if (!user || !currentRecipe) return;
  
    try {
      const recipesRef = collection(db, 'users', user.uid, 'recipes');
      await addDoc(recipesRef, {
        name: currentRecipe.name,
        ingredients: currentRecipe.ingredients,
        instructions: currentRecipe.instructions,
        dateCreated: new Date()
      });
  
      toast.success("Recipe saved to your account!");
    } catch (err) {
      console.error("Error saving recipe:", err);
      toast.error("Failed to save recipe.");
    }
  };  
  

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };



  const getStoreLink = (ingredientName) => {
    const query = encodeURIComponent(ingredientName);
    if (store === "safeway") {
      return `https://www.safeway.com/shop/search-results.html?q=${query}`;
    } else if (store === "kroger") {
      return `https://www.kroger.com/search?query=${query}`;
    } else {
      return "#";
    }
  };
  
  const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  };

  useEffect(() => {
    // Check if the user was redirected with an auth success parameter
    const authSuccess = getQueryParam("authSuccess");
    if (authSuccess === "true") {
      setKrogerSignInAuthed(true); // Update the button state to green
      console.log("User authenticated successfully via callback.");
    }
  }, []);

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
  // NEW Function to fetch past recipes
  const fetchPastRecipes = async () => {
    if (!user) return;
  
    setPastRecipesLoading(true);
    try {
      const queryRef = collection(db, "users", user.uid, "recipes");
  
      let snapshot;
      try {
        snapshot = await getDocsFromCache(queryRef);
        if (snapshot.empty) {
          snapshot = await getDocs(queryRef);
        }
      } catch {
        snapshot = await getDocs(queryRef);
      }
  
      const recipeMap = new Map();
  
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const key = `${data.name}-${JSON.stringify(data.ingredients)}`;
        if (!recipeMap.has(key)) {
          recipeMap.set(key, {
            ...data,
            id: doc.id,
            ingredients: data.ingredients.map((ing) => ({
              ...ing,
              confirmed: false
            }))
          });
        }
      });
  
      const uniqueRecipes = Array.from(recipeMap.values());
  
      setPastRecipes(uniqueRecipes);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      setPastRecipes([]);
    } finally {
      setPastRecipesLoading(false);
    }
  };
  
  
  
  // Fetch past recipes when visiting the Past Recipes view
  useEffect(() => {
    if (currentView === 'pastRecipes') {
      fetchPastRecipes();
    }
  }, [currentView]);
  
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
        throw new Error('click the login with kroger button to authenticate');
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
      
      // Keep pantry status and confirmation for ingredients that exist in both recipes
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
  
  // Handle removing an ingredient (unused in final UI, but kept here if needed)
  const handleRemoveIngredient = (indexToRemove) => {
    const updatedRecipe = { ...currentRecipe };
    updatedRecipe.ingredients = updatedRecipe.ingredients.filter((_, index) => index !== indexToRemove);
    setCurrentRecipe(updatedRecipe);
  };
  
  // Handle confirming an ingredient
  const handleConfirmIngredient = (index) => {
    const updatedRecipe = { ...currentRecipe };
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
    setCartStatus('adding'); // Show "adding" overlay

    try {
      const result = await addItemsToCart(confirmedIngredients, 'kroger');

      if (result.success) {
        setCartStatus('success'); // Show success overlay & "Go to Cart" button
      } else {
        setCartStatus('error');   // Show error overlay
      }
    } catch (error) {
      setCartStatus('error');     // Show error overlay
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Helper function to create a short description from the recipe
  const createRecipeDescription = (recipe) => {
    const ingredients = recipe.ingredients.slice(0, 3).map(ing => ing.name).join(', ');
    return `A recipe with ${ingredients}${recipe.ingredients.length > 3 ? ', and more' : ''}.`;
  };

  return (
    <div className="nutrify-container">
      {/* ---------- SIDEBAR ---------- */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <MessageCircle size={16} />
          </div>
          <span className="logo-text glow-outline">Grubify</span>
          <ChevronDown className="dropdown-icon" size={16} />
        </div>
        
        {/* Navigation menu */}
        <div className="nav-menu">
          {user && (
            <button 
              className="nav-item"
              onClick={() => setCurrentView('pastRecipes')}
            >
              <Compass size={16} />
              <span>Recipe History</span>
            </button>
          )}
        </div>

        {/* Login button */}
        <div className="nav-item-container" style={{ padding: "15px 20px", marginBottom: "20px" }}>
        <button
            className="upgrade-button"
            onClick={() => window.open("http://127.0.0.1:5000/login", "_blank")}
            style={{
              backgroundColor: krogerSignInAuthed ? "green" : "",
              color: krogerSignInAuthed ? "white" : "",
            }}
          >
            <span>{krogerSignInAuthed ? "Logged in Kroger" : "Login with Kroger"}</span>
          </button>
        </div>
        <div className="sidebar-auth">
          {user ? (
            <>
              <div className="user-email">👋 Welcome back, <strong>{user.displayName || user.email}</strong></div>
              <button className="auth-button" onClick={handleLogout}>Log Out</button>
            </>
          ) : (
            <button className="auth-button" onClick={() => setIsModalOpen(true)}>
              Sign In
            </button>
          )}
        </div>


      </div>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="main-content">
        {/* Profile icon in top-right */}
        
        {/* ---------- INPUT VIEW ---------- */}
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
                  Grubify helps you find recipes and purchase ingredients from grocery delivery services.
                  Always check for allergens and nutritional information.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* ---------- DETAILS VIEW ---------- */}
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
            <div className="store-toggle">
            <span className="toggle-label">
              Where do you want to shop?
              <div className="tooltip-wrapper">
                <span className="info-icon">ℹ️</span>
                <div className="tooltip-text">
                  If you choose Safeway, click the logo next to each ingredient to shop for it.
                </div>
              </div>
            </span>


              <div className="store-options">
                <button
                  className={`store-btn ${store === 'kroger' ? 'active' : ''}`}
                  onClick={() => setStore('kroger')}
                >
                  Kroger
                </button>
                <button
                  className={`store-btn ${store === 'safeway' ? 'active' : ''}`}
                  onClick={() => setStore('safeway')}
                >
                  Safeway
                </button>
              </div>
              {store === 'safeway' && (
                <p className="store-helper-text">
                  🛒 Click the Safeway logo next to each ingredient to shop for it.
                </p>
              )}

              {store === 'kroger' && (
                <p className="store-helper-text">
                  ✅ Select ingredients by clicking the green check mark next to each one you want us to add to your cart.<br />
                  🔐 Make sure you’re signed in to Kroger first.<br />
                  🛒 Then press <strong>Order with Kroger</strong> to build your cart.
                </p>
              )}


            </div>


            
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

                    {/* 🔽 Only show link if store is Safeway 🔽 */}
                    {store === 'safeway' && (
                      <a
                        href={getStoreLink(ingredient.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="safeway-card"
                        title="Shop this item on Safeway"
                      >
                        <img
                          src="/safeway-logo.svg"
                          alt="Shop on Safeway"
                          className="safeway-logo"
                        />
                      </a>
                    )}

                    <div className="ingredient-actions">
                      <button
                        className={`confirm-button ${ingredient.confirmed ? 'confirmed' : ''}`}
                        onClick={() => handleConfirmIngredient(index)}
                        title={ingredient.confirmed ? "Unconfirm" : "Confirm"}
                      >
                        <Check size={16} />
                      </button>
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
                  
                  {store === 'kroger' && (
                    <div className="grocery-options">
                      <button
                        className="grocery-button kroger"
                        onClick={handleOrderWithKroger}
                        disabled={
                          loading ||
                          currentRecipe.ingredients.filter(i => !i.inPantry && i.confirmed).length === 0
                        }
                      >
                        <ShoppingCart size={16} />
                        <span>Order with Kroger</span>
                      </button>
                    </div>
                  )}
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
                
                <button 
                  className="save-recipe-button"
                  onClick={handleSaveRecipe}
                  disabled={recipeSaving}
                >
                  <Save size={16} />
                  <span>Save to My Recipes</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* ---------- PAST RECIPES VIEW ---------- */}
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
            
            {pastRecipesLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading your recipes...</p>
              </div>
            ) : pastRecipes.length === 0 ? (
              <div className="no-recipes-message">
                <p>You don't have any saved recipes yet.</p>
                <button 
                  className="primary-button"
                  onClick={() => setCurrentView('input')}
                >
                  Create Your First Recipe
                </button>
              </div>
            ) : (
              <div className="recipe-history-grid">
                {pastRecipes.map((recipe, index) => (
                  <div key={index} className="recipe-card">
                    <div className="recipe-card-header">
                      <h3>{recipe.name}</h3>
                      <span className="recipe-date">
                        {recipe.dateCreated ? formatDate(recipe.dateCreated) : 'No date'}
                      </span>
                    </div>
                    <p className="recipe-description">
                      {createRecipeDescription(recipe)}
                    </p>
                    <div className="recipe-card-actions">
                      <button
                        className="card-action-button"
                        onClick={() => {
                          // Make sure all ingredients have the confirmed property
                          const preparedRecipe = {
                            ...recipe,
                            ingredients: recipe.ingredients.map(ingredient => ({
                              ...ingredient,
                              confirmed: false
                            }))
                          };
                          setCurrentRecipe(preparedRecipe);
                          setCurrentView('details');
                        }}
                      >
                        View Recipe
                      </button>
                      <button
                        className="card-action-button"
                        onClick={() => {
                          // Make sure all ingredients have the confirmed property, and
                          // auto-confirm items not in pantry
                          const preparedRecipe = {
                            ...recipe,
                            ingredients: recipe.ingredients.map(ingredient => ({
                              ...ingredient,
                              confirmed: !ingredient.inPantry
                            }))
                          };
                          setCurrentRecipe(preparedRecipe);
                          setCurrentView('details');
                        }}
                      >
                        Reorder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* ---------- CART STATUS OVERLAYS ---------- */}
      {cartStatus && (
        <div className="cart-status-overlay">
          <div className={`cart-status-box ${cartStatus}`}>
            {cartStatus === 'adding' && (
              <>
                <div className="loading-animation">
                  <div className="cart-loader"></div>
                </div>
                <h3>Adding Items to Kroger</h3>
                <p>Please wait while we add your ingredients to your Kroger cart.</p>
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
                <button 
                  className="secondary-button" 
                  onClick={() => setCartStatus(null)}
                >
                  Cancel
                </button>
              </>
            )}

            {cartStatus === 'success' && (
              <>
                <div className="status-icon success">
                  <Check size={32} />
                </div>
                <h3>Success!</h3>
                <p>All items have been added to your Kroger cart</p>
                <div className="action-buttons">
                  <button
                    className="primary-button"
                    onClick={() => window.open('https://www.kroger.com/cart', '_blank')}
                  >
                    <ShoppingCart size={16} />
                    Go to Kroger Cart
                  </button>
                  <button 
                    className="secondary-button" 
                    onClick={() => setCartStatus(null)}
                  >
                    Continue Making Recipes
                  </button>
                </div>
              </>
            )}

            {cartStatus === 'error' && (
              <>
                <div className="status-icon error">
                  <X size={32} />
                </div>
                <h3>Connection Error</h3>
                <p>We couldn't add items to your Kroger cart</p>
                <p className="error-detail">Please make sure you've logged in with your Kroger account</p>
                <div className="action-buttons">
                  <button
                    className="primary-button"
                    onClick={() => window.open("http://127.0.0.1:5000/login", "_blank")}
                  >
                    Login with Kroger
                  </button>
                  <button 
                    className="secondary-button" 
                    onClick={() => setCartStatus(null)}
                  >
                    Try Again Later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Login Modal"
        className="login-modal"
        overlayClassName="login-overlay"
      >
        <div className="auth-card">
          <h3 className="auth-title">Log In to Save Recipes</h3>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
          <button className="auth-button primary" onClick={handleEmailLogin}>Log In</button>
          <button className="auth-button secondary" onClick={handleEmailSignup}>Sign Up</button>
          <div className="auth-divider">or</div>
          <button className="auth-button google" onClick={handleGoogleLogin}>
            <span className="google-icon" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 48 48"
              >
                <path fill="#EA4335" d="M24 9.5c3.13 0 5.89 1.08 8.09 2.85l6.03-6.03C34.6 2.55 29.67 0 24 0 14.61 0 6.69 5.73 2.69 14.01l7.05 5.48C11.94 13.13 17.5 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24c0-1.34-.11-2.64-.3-3.9H24v7.39h12.75c-.56 3.01-2.22 5.56-4.69 7.28l7.21 5.61C43.6 35.3 46.5 30.1 46.5 24z"/>
                <path fill="#FBBC05" d="M9.74 28.49c-.47-1.4-.74-2.89-.74-4.49s.27-3.09.74-4.49L2.69 14.01C1.03 17.3 0 20.97 0 24.99c0 4.02 1.03 7.69 2.69 10.98l7.05-5.48z"/>
                <path fill="#34A853" d="M24 48c5.67 0 10.44-1.87 13.92-5.1l-7.21-5.61c-2.01 1.34-4.58 2.12-6.71 2.12-6.5 0-12.06-3.63-14.26-8.99l-7.05 5.48C6.69 42.27 14.61 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Sign in with Google
            </span>
          </button>

          <button className="auth-button secondary" style={{ marginTop: "10px" }} onClick={() => setIsModalOpen(false)}>
            Cancel
          </button>
        </div>
      </Modal>

      
    </div>
  );
};

export default NutrifyAI;
