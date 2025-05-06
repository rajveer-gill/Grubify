import React, { useState, useEffect } from 'react';
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut, sendEmailVerification, fetchSignInMethodsForEmail, sendPasswordResetEmail} from "firebase/auth";
import { useAuth } from "./hooks/useAuth";
import Modal from 'react-modal';
import toast from 'react-hot-toast';
import { db } from './firebase'; // already good
import { doc, updateDoc, deleteDoc, collection, addDoc, getDocs, getDocsFromCache } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import {
  MessageCircle,
  Compass,
  ChevronDown,
  ChevronUp,
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showNutrition, setShowNutrition] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  

  useEffect(() => {
    if (inputValue.length === 0) {
      setFilteredSuggestions([]);
      return;
    }
  
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${inputValue}`);
        const data = await res.json();
        if (data.meals) {
          const suggestions = data.meals.map((meal) => meal.strMeal);
          setFilteredSuggestions(suggestions);
        } else {
          setFilteredSuggestions([]);
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setFilteredSuggestions([]);
      }
    };
  
    const timeout = setTimeout(fetchSuggestions, 300); // debounce
    return () => clearTimeout(timeout);
  }, [inputValue]);
  


  useEffect(() => {
    if (user && isModalOpen) {
      setIsModalOpen(false);
    }
  }, [user, isModalOpen]);
  

  const getKrogerToken = async () => {
    try {
      const res = await fetch("https://us-central1-grubify-9cf13.cloudfunctions.net/krogerAuthToken", {
        method: "POST",
      });
      const data = await res.json();
      console.log("Kroger token:", data.accessToken);
      return data.accessToken;
    } catch (err) {
      console.error("Failed to fetch Kroger token:", err);
      return null;
    }
  };

  const handleToggleAllIngredients = () => {
    const allConfirmed = currentRecipe.ingredients.every(ingredient => ingredient.confirmed);
    const updatedIngredients = currentRecipe.ingredients.map(ingredient => ({
      ...ingredient,
      confirmed: !allConfirmed
    }));
    setCurrentRecipe(prev => ({
      ...prev,
      ingredients: updatedIngredients
    }));
  };
  
  
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
  
      if (!user.emailVerified) {
        toast.error('Please verify your email before logging in.');
        return;
      }
  
      toast.success('Welcome back!');
    } catch (err) {
      toast.error('Email login failed.');
      console.error(err);
    }
  };  
  
  const handleEmailSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      toast.success('Account created successfully! Please check your email for verification.');
  
      setEmail('');
      setPassword('');

      try {
        await sendEmailVerification(user);
        toast.success('Verification email sent!');
      } catch (verifyErr) {
        console.error("Error sending verification email:", verifyErr);
        toast.error('Failed to send verification email. You can resend it later.');
      }
  
      setIsModalOpen(false); // close modal after signup
    } catch (signupErr) {
      console.error("Error during signup:", signupErr);
      if (signupErr.code === 'auth/email-already-in-use') {
        toast.error('Email already in use. Please log in instead.');
      } else if (signupErr.code === 'auth/invalid-email') {
        toast.error('Invalid email format.');
      } else if (signupErr.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters.');
      } else {
        toast.error('Signup failed. Please try again.');
      }
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
        dateCreated: new Date(),
        lastAccessed: new Date()
      });

  
      toast.success("Recipe saved to your account!");
    } catch (err) {
      console.error("Error saving recipe:", err);
      toast.error("Failed to save recipe.");
    }
  }; 
  
  const handleRemoveRecipe = async (recipeId) => {
    if (!user || !recipeId) return;
  
    try {
      const recipeRef = doc(db, "users", user.uid, "recipes", recipeId);
      await deleteDoc(recipeRef);
      setPastRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
    } catch (error) {
      console.error("Error removing recipe:", error);
      alert("Failed to remove the recipe.");
    }
  };
  

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        const user = auth.currentUser;
        await user.delete();
        toast.success("Account deleted successfully.");
        window.location.reload(); // Optionally log them out/reload
      } catch (error) {
        console.error("Error deleting account:", error);
        toast.error("Failed to delete account. You may need to re-login to confirm.");
      }
    }
  };
  

  const handleResendVerification = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast.success("Check your inbox for the verification email!");
      } else {
        toast.error("No user is currently signed in.");
      }
    } catch (err) {
      toast.error(`Failed to send verification: ${err.message}`);
      console.error("Verification error:", err);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast.error("Please enter an email.");
      return;
    }
  
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setIsResetModalOpen(false);
      setResetEmail('');
    } catch (err) {
      console.error("Reset failed:", err);
      if (err.code === "auth/user-not-found") {
        toast.error("No account found with this email.");
      } else if (err.code === "auth/invalid-email") {
        toast.error("Invalid email format.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  };

  const fetchNutritionInfo = async (ingredients) => {
    try {
      const response = await fetch('https://grubify.onrender.com/calculate-nutrition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredients })
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch nutrition info');
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching nutrition info:', error);
      return null;
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
    const authSuccess = getQueryParam("authSuccess");
    if (authSuccess === "true") {
      // mark UI as logged‑in…
      setKrogerSignInAuthed(true);
      console.log("User authenticated successfully via callback.");
      // …and grab/store the user‑level token
      fetch("https://grubify.onrender.com/token", {
        method: "GET",
        credentials: "include"  // ← send the session cookie
      })
        .then(res => res.json())
        .then(d => {
          localStorage.setItem("kroger_user_token", d.user_token);
          console.log("🔑 Stored Kroger user token");
        })
        .catch(err => console.error("token fetch failed:", err));
    }
  }, []);

  
  
    // Refresh the user's email verification status
  useEffect(() => {
    const refreshUser = async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
    };
    const interval = setInterval(() => {
      refreshUser();
    }, 5000); // check every 5 seconds

    return () => clearInterval(interval);
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

  // NEW Function to fetch past recipes
  const fetchPastRecipes = async () => {
    if (!user) {
      console.warn("User is not defined yet.");
      return;
    }
  
    console.log("Fetching recipes for:", user.uid);
    setPastRecipesLoading(true);
  
    try {
      const queryRef = collection(db, "users", user.uid, "recipes");
  
      let snapshot;
      try {
        snapshot = await getDocsFromCache(queryRef);
        console.log("Got snapshot from cache");
        if (snapshot.empty) {
          console.log("Cache was empty, trying server...");
          snapshot = await getDocs(queryRef);
        }
      } catch (cacheError) {
        console.warn("Cache failed, fetching from server...", cacheError);
        snapshot = await getDocs(queryRef);
      }
  
      if (snapshot.empty) {
        console.warn("No recipes found.");
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
  
      const uniqueRecipes = Array.from(recipeMap.values())
        .sort((a, b) => {
          const aTime = new Date(a.lastAccessed || a.dateCreated).getTime();
          const bTime = new Date(b.lastAccessed || b.dateCreated).getTime();
          return bTime - aTime; // most recent first
        });


      

      console.log("Fetched unique recipes:", uniqueRecipes);

      setPastRecipes(uniqueRecipes);

    } catch (err) {
      console.error("🔥 Error fetching recipes:", err);
      setPastRecipes([]);
    } finally {
      setPastRecipesLoading(false);
      console.log("Finished loading recipes");
    }
  };
  
  
  
  
  // Fetch past recipes when visiting the Past Recipes view
  useEffect(() => {
    if (currentView === 'pastRecipes' && user) {
      fetchPastRecipes();
    }
  }, [currentView, user]);
  

  useEffect(() => {
    if (user && pastRecipes.length === 0) {
      fetchPastRecipes();
    }
  }, [user]);
  
  
  
  // Function to fetch recipe from our Python backend
  const fetchRecipeFromAPI = async (description) => {
    try {
      const response = await fetch('https://generaterecipe-eyg4dno7ja-uc.a.run.app', {
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
      return data.structured_recipe;
    } catch (error) {
      console.error('Error fetching recipe:', error);
      throw error;
    }
  };
  
  
  
  
  
  // Function to modify existing recipe through the API
  const modifyRecipeFromAPI = async (originalRecipe, modifications) => {
    try {
      const response = await fetch('https://grubify.onrender.com/refine-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_recipe: originalRecipe,
          edit_instruction: modifications
        }),        
      });
      
      if (!response.ok) {
        throw new Error('Failed to modify recipe');
      }
      
      const data = await response.json();
      return data; // This way it can be parsed later
    } catch (error) {
      console.error('Error modifying recipe:', error);
      throw error;
    }
  };
  
  // Function to fetch prices for ingredients
  const fetchIngredientPrices = async (ingredients, store = 'kroger') => {
    try {
      const response = await fetch('https://generaterecipe-eyg4dno7ja-uc.a.run.app/fetch-prices', {
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
  
  // Function to add items to cart (include Kroger user token)
  const addItemsToCart = async (items) => {
    // grab the logged-in Kroger token (set by your OAuth callback)
    const userToken = localStorage.getItem("kroger_user_token");
    if (!userToken) {
      toast.error("🔐 Please log in to Kroger first.");
      return { success: false };
    }

    try {
      const res = await fetch(
        "https://us-central1-grubify-9cf13.cloudfunctions.net/addToKrogerCart",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            items: items.map(i => i.name)   // send ["avocado","kale",…], not full objects
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(`❌ ${data.error || "Could not add to cart"}`);
        return { success: false };
      }
      toast.success("✅ Added to Kroger cart!");
      return { success: true };
    } catch (err) {
      console.error("addItemsToCart error:", err);
      toast.error("❌ Network error, try again.");
      return { success: false };
    }
  };
  
  
  // Handle recipe submission with API call
  const handleSubmitRecipe = async () => {
    if (inputValue.trim() === '') return;
    
    setFilteredSuggestions([]);
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
      
      const nutritionData = await fetchNutritionInfo(recipeWithPantry.ingredients);

      if (nutritionData) {
        recipeWithPantry.nutrition = nutritionData;
      }

      setCurrentRecipe(recipeWithPantry);
      setCurrentView('details');

    } catch (error) {
      console.error("Error getting recipe:", error);
      toast.error("Sorry, no recipes could be generated. Please try describing your dish differently!");
      setError(null);
      setCurrentRecipe(null);
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
  
      const updatedRecipe = {
        ...modifiedRecipe,
        ingredients: modifiedRecipe.ingredients.map(newIngredient => {
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
  
      // 🔥 ADD THIS: fetch nutrition for the updated recipe
      const updatedNutrition = await fetchNutritionInfo(updatedRecipe.ingredients);
      if (updatedNutrition) {
        updatedRecipe.nutrition = updatedNutrition;
      }
      
      // Add system response to chat history
      setChatHistory(prevHistory => [
        ...prevHistory,
        { 
          text: `Recipe updated!`,
          sender: 'system',
          timestamp: new Date().toISOString()
        }
      ]);
      
      setCurrentRecipe(updatedRecipe);
    } catch (error) {
      console.error("Error modifying recipe:", error);
      
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
    if (!krogerSignInAuthed) {
      toast.error("🔐 Please log in to your Kroger account before ordering.");
      return;
    }
  
    const confirmedIngredients = currentRecipe.ingredients
      .filter(ing => ing.confirmed && !ing.inPantry)
      .map(ing => ing.name);
  
    if (confirmedIngredients.length === 0) {
      toast.error("✅ Please confirm at least one ingredient to order.");
      return;
    }
  
    setLoading(true);
    setCartStatus('adding'); // Show "adding" overlay
  
    try {
      const result = await addItemsToCart(confirmedIngredients, 'kroger');
  
      if (result.success) {
        setCartStatus('success');
      } else {
        setCartStatus('error');
      }
    } catch (error) {
      setCartStatus('error');
    } finally {
      setLoading(false);
    }
  };
  

  // Helper function to format date
  const formatDate = (dateValue) => {
    let date;
  
    if (dateValue?.toDate) {
      // Firestore Timestamp object
      date = dateValue.toDate();
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      // ISO string or timestamp number
      date = new Date(dateValue);
    } else {
      return 'Unknown date';
    }
  
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-container glow-outline">
            <img
              src="/grubify-logo.png"
              alt="Grubify Logo"
              style={{ width: "60px", height: "60px" }}
            />
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
        {sidebarOpen && (
          <div className="nav-item-container" style={{ padding: "15px 20px", marginBottom: "20px" }}>
            <button
                className="upgrade-button"
                onClick={() => window.open("https://grubify.onrender.com/login", "_blank")}
                style={{
                  backgroundColor: krogerSignInAuthed ? "green" : "",
                  color: krogerSignInAuthed ? "white" : "",
                }}
              >
              <span>{krogerSignInAuthed ? "Logged in Kroger" : "Login with Kroger"}</span>
            </button>
          </div>
        )}
        <div className="sidebar-auth">
          {user && sidebarOpen && (
            <div className="user-email">
              👋 Welcome back, <strong>{user.displayName || user.email}</strong>
            </div>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sidebar-toggle-button"
          >
            {sidebarOpen ? "←" : "→"}
          </button>

          {user && sidebarOpen && !user.emailVerified && (
            <button
              className="auth-button"
              style={{ backgroundColor: '#444', color: '#fff' }}
              onClick={handleResendVerification}
            >
              Resend Verification Email
            </button>
          )}

          {!user && sidebarOpen && (
            <button
              className="auth-button"
              onClick={() => setIsModalOpen(true)}
            >
              Sign In
            </button>
          )}
        </div>

        {user && (
          <div className="logout-container" style={{ marginTop: "auto", padding: "20px" }}>
            <button onClick={handleDeleteAccount} className="profile-option delete-account-button">
              Delete Account
            </button>

            <button className="logout-button" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        )}



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
              <div className="center-input-container"> 
                <div className="autocomplete-wrapper" style={{ position: "relative", width: "100%" }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter whatever you want to eat with any personalizations you want. Get Creative!"
                    className="center-text-input"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading) handleSubmitRecipe();
                    }}
                  />
                  {!loading && filteredSuggestions.length > 0 && (
                    <ul className="autocomplete-list">
                      {filteredSuggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          className="autocomplete-item"
                          onClick={() => {
                            setInputValue(suggestion);
                            setFilteredSuggestions([]);
                          }}
                        >
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

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
                  🛒 Just deselect any ingredients you already have at home by clicking the <strong>✔️ </strong>, and we'll add everything you need to your Kroger cart for you!<br />
                  🔐 Make sure you’re signed in to Kroger first.<br />
                  🛒 Then press <strong>Order with Kroger</strong> to build your cart.
                </p>
              )}


            </div>


            
            <div className="recipe-content">
              <div className="ingredients-section">
                <h2>Ingredients</h2>
                <button
                  className="toggle-all-button"
                  onClick={handleToggleAllIngredients}
                  style={{
                    backgroundColor: "#4caf50",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}
                >
                  {currentRecipe.ingredients.every(ing => ing.confirmed) ? "Deselect All" : "Select All"}
                </button>
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
                <div className="instructions-dropdown">
                  <button
                    className="instructions-toggle"
                    onClick={() => setInstructionsOpen(!instructionsOpen)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 16px",
                      backgroundColor: "#1e1e1e",
                      color: "white",
                      border: "1px solid #4caf50",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "10px"
                    }}
                  >
                    <span>Instructions</span>
                    <span
                      className={`toggle-icon ${instructionsOpen ? 'rotate' : ''}`}
                      style={{
                        color: "black",
                        backgroundColor: "#4caf50",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        boxShadow: "0 0 8px #4caf50, 0 0 12px #4caf50"
                      }}
                    >
                      ▲
                    </span>

                  </button>

                  <ol className={`instructions-list ${instructionsOpen ? 'open' : ''}`}>
                    {currentRecipe.instructions.map((step, index) => (
                      <li key={index} className="instruction-step">
                        <strong>Step {index + 1}:</strong> {step}
                      </li>                    
                    ))}
                  </ol>
                </div>

                {/*Nutrition Info Dropdown */}
                <div className="nutrition-dropdown">
                  <button
                    className="nutrition-toggle"
                    onClick={() => setShowNutrition(!showNutrition)}
                  >
                    <span>Nutrition Info</span>
                    <span
                      className={`toggle-icon ${showNutrition ? 'rotate' : ''}`}
                      style={{
                        color: "black",
                        backgroundColor: "#4caf50",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                        boxShadow: "0 0 8px #4caf50, 0 0 12px #4caf50"
                      }}
                    >
                      ▲
                    </span>
                  </button>

                  {showNutrition && (
                    <div className="nutrition-content">
                      {currentRecipe?.nutrition ? (
                        <>
                          <div className="nutrition-item">
                            <span><strong>Calories:</strong></span>
                            <span>{currentRecipe.nutrition.calories} kcal</span>
                          </div>
                          <div className="nutrition-item">
                            <span><strong>Protein:</strong></span>
                            <span>{currentRecipe.nutrition.protein} g</span>
                          </div>
                          <div className="nutrition-item">
                            <span><strong>Carbs:</strong></span>
                            <span>{currentRecipe.nutrition.carbs} g</span>
                          </div>
                          <div className="nutrition-item">
                            <span><strong>Fat:</strong></span>
                            <span>{currentRecipe.nutrition.fat} g</span>
                          </div>
                          <div className="nutrition-item">
                            <span><strong>Fiber:</strong></span>
                            <span>{currentRecipe.nutrition.fiber} g</span>
                          </div>
                          <div className="nutrition-item">
                            <span><strong>Sugar:</strong></span>
                            <span>{currentRecipe.nutrition.sugar} g</span>
                          </div>
                          <div className="nutrition-item">
                            <span><strong>Sodium:</strong></span>
                            <span>{currentRecipe.nutrition.sodium} mg</span>
                          </div>
                        </>
                      ) : (
                        <p>Nutrition info not available.</p>
                      )}
                    </div>
                  )}
                </div>



                <button 
                  className="save-recipe-button"
                  onClick={handleSaveRecipe}
                  disabled={recipeSaving}
                >
                  <Save size={16} />
                  <span>Save to My Recipes</span>
                </button>
                <div className="recipe-chat-container">
                  <h3>Modify Your Recipe</h3>
                  <div className="chat-help-text">
                    Ask for tweaks like "make it spicier", "remove nuts", "add more garlic", etc.
                  </div>

                  {chatHistory.length > 0 && (
                    <div className="chat-history">
                      {chatHistory.map((msg, index) => (
                        <div
                          key={index}
                          className={`chat-message ${msg.sender} ${msg.isError ? 'error' : ''}`}
                        >
                          {msg.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="chat-input-container">
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Type your recipe change..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={modificationLoading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !modificationLoading) handleRecipeModification();
                      }}
                    />
                    <button
                      className="chat-send-button"
                      onClick={handleRecipeModification}
                      disabled={modificationLoading}
                    >
                      {modificationLoading ? (
                        <div className="chat-loading-spinner"></div>
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>

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
                        onClick={async () => {
                          const preparedRecipe = {
                            ...recipe,
                            ingredients: recipe.ingredients.map(ingredient => ({
                              ...ingredient,
                              confirmed: false
                            }))
                          };
                        
                          // Update lastAccessed timestamp in Firestore
                          try {
                            const recipeRef = doc(db, "users", user.uid, "recipes", recipe.id);
                            await updateDoc(recipeRef, {
                              lastAccessed: new Date()
                            });
                          } catch (error) {
                            console.error("Failed to update lastAccessed:", error);
                          }
                        
                          setCurrentRecipe(preparedRecipe);
                          setCurrentView("details");
                        }}
                        
                      >
                        View Recipe
                      </button>
                      <button
                        className="card-action-button"
                        onClick={() => handleRemoveRecipe(recipe.id)}
                      >
                        Remove
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
          <p
            className="forgot-password-text"
            onClick={() => setIsResetModalOpen(true)}
          >
            Forgot Password?
          </p>

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
      <Modal
        isOpen={isResetModalOpen}
        onRequestClose={() => setIsResetModalOpen(false)}
        contentLabel="Reset Password Modal"
        className="login-modal"
        overlayClassName="login-overlay"
      >
        <div className="auth-card">
          <h3 className="auth-title">Reset Your Password</h3>
          <input
            type="email"
            placeholder="Enter your email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="auth-input"
          />
          <button className="auth-button primary" onClick={handlePasswordReset}>
            Send Reset Email
          </button>
          <button
            className="auth-button secondary"
            onClick={() => setIsResetModalOpen(false)}
            style={{ marginTop: "10px" }}
          >
            Cancel
          </button>
        </div>
      </Modal>


      
    </div>
  );
};

export default NutrifyAI;
