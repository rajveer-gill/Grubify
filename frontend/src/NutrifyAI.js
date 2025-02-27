import React, { useState } from 'react';
import { MessageCircle, BookOpen, Code, Compass, ChevronDown, Plus, Mic, Info } from 'lucide-react';
import './NutrifyAI.css'; // Create this CSS file

const NutrifyAI = () => {
  const [inputValue, setInputValue] = useState('');
  
  return (
    <div className="nutrify-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <MessageCircle size={18} />
          </div>
          <span className="logo-text">Nutrify AI</span>
          <ChevronDown className="dropdown-icon" size={18} />
        </div>
        
        {/* Sidebar Menu */}
        <div className="sidebar-menu">
          <div className="menu-section">
            <button className="menu-item">
              <MessageCircle size={16} />
              <span>Meal Planner</span>
            </button>
            <button className="menu-item">
              <BookOpen size={16} />
              <span>Nutrition Facts</span>
            </button>
            <button className="menu-item">
              <Code size={16} />
              <span>Recipe Creator</span>
            </button>
            <button className="menu-item">
              <Compass size={16} />
              <span>Past Recipes</span>
            </button>
          </div>
          
          {/* Recent Conversations */}
          <div className="history-section">
            <div className="history-title">Previous 30 Days</div>
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
            
            {/* More history items */}
            <div className="history-title">January</div>
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
            <button className="history-item">
              Intermittent Fasting Guide
            </button>
            <button className="history-item">
              Macro Calculator Setup
            </button>
          </div>
        </div>
        
        {/* Upgrade button */}
        <div className="sidebar-footer">
          <button className="upgrade-button">
            <Info size={16} />
            <span>Nutrify Plus</span>
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {/* Empty chat with prompt */}
        <div className="chat-area">
          <h1 className="main-heading">How can I help with nutrition today?</h1>
          <div className="center-query-container">
            <div className="center-input-wrapper">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about nutrition, recipes, or meal plans..."
                className="center-text-input"
              />
              <div className="center-input-buttons">
                <button className="icon-button">
                  <Plus size={18} />
                </button>
                <button className="icon-button">
                  <Mic size={18} />
                </button>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="disclaimer-container">
              <div className="disclaimer">
                Nutrify AI provides nutritional guidance based on general principles. The information may not be accurate for all individuals and situations. Always consult with a healthcare professional for medical advice.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutrifyAI;