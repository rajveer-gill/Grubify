# Software Requirements Specification (SRS)

## 1. Problem Statement
Many people struggle with planning meals because they do not know what to cook or lack an easy way to gather the necessary ingredients. Our application provides a solution by:
- Generating meal recipes using AI.
- Listing the required ingredients for each recipe.
- Finding ingredient availability at the nearest Kroger-affiliated store.
- Allowing users to filter by price for affordability.
- Providing a seamless option to add items to a cart for easy purchasing.
- Storing past recipes and ingredient lists for future use.

---

## 2. Description of Users

### User Classes
1. General Users (Shoppers)
   - Want quick and easy recipe suggestions.
   - Need ingredient lists generated automatically.
   - Expect a simple and intuitive UI for browsing recipes and adding items to a cart.
   - Might want to save and revisit past recipes.

2. Authenticated Users (Registered Shoppers)
   - Can store and retrieve past recipes and ingredient lists.
   - Have access to personalized shopping recommendations.
   - Can log in using authentication methods (via Kroger API).

3. System Administrators
   - Manage database storage of recipes and ingredients.
   - Ensure smooth API integration and system maintenance.
   - Monitor user authentication and data security.

---

## 3. Scenarios / Use Cases

### Scenario 1: User Generating a Recipe and Shopping for Ingredients
Actor: General User  
Steps:  
1. The user enters a dish (e.g., "Chicken Dishes").  
2. The system generates a recipe using OpenAI’s API.  
3. The system displays the ingredients required for the recipe.  
4. The user checks off any ingredients that they don't need to add to cart.  
5. The user logs into there kroger account and adds the ingredients to cart.

### Scenario 2: User Saving and Retrieving Past Recipes
Actor: General User
Steps:  
1. User clicks 'Save to my Recipes'
2. The system retrieves stored recipes and ingredient lists from the database.  
3. The user selects a past recipe and re-adds ingredients to their cart.  

---

## 4. Detailed Description of Requirements

### Functional Requirements
Absolutely Required:
1. The system must generate recipes using OpenAI API.
2. The system must provide a list of required ingredients.
3. The system must search for ingredients at Kroger-affiliated stores.
4. The system must allow users to filter ingredient prices before purchase.
5. The system must allow users to add selected ingredients to a cart.
6. The system must handle user authentication (for saving past recipes and shopping history).
7. The system must allow storing and retrieving past recipes and ingredient lists.
8. The system must ensure fast response times for search and cart operations.

Not Absolutely Required:
9. The system should allow users to rate and review recipes.
10. The system should support multi-store price comparison (e.g., Instacart in future versions).
11. The system should support meal planning for a week.

---

## 5. Reflection on Implementation

### Changes from Initial Requirements:
- Originally planned multi-store ingredient search but limited to Kroger API due to time constraints.
- Mobile-responsive UI was considered but not implemented in this version.
- Personalized meal planning was removed to keep the system lightweight.

### Deferred Features and Rationale:
1. Instacart API Integration – Deferred to a future update to support multiple grocery providers.
2. User Ratings for Recipes – Not necessary for core functionality but may enhance user experience later.
3. Web-based authentication flow – Simplified to session-based login for now.

---

## 6. Technical Specification

### Technology Stack

#### Frontend:
- React → For UI development and dynamic rendering.
- CSS/Bootstrap → Styling and responsiveness.

#### Backend:
- Flask → API server handling business logic.
- Python-dotenv → Secure environment variable management.
- Requests → Used for API calls to Kroger and OpenAI.
- Selenium → Automating shopping cart interactions.

#### APIs Used:
- Kroger API → Used for:
  - Cart management (adding ingredients to a cart).
  - Product search (finding ingredient availability & pricing).
  - Store location lookup (finding nearby Kroger stores).
- OpenAI API → Used for:
  - Generating recipes based on user inputs.
  - Providing structured ingredient lists.

#### Database:
- SQLite3 → Used to store past recipes and shopping history.

#### Deployment & DevOps:
- GitHub Actions → Automates build and test workflows.
- Docker (future plan) → Planned for containerized deployment.

---

## 7. Conclusion
This document outlines the functional and technical requirements for our recipe-generation and shopping cart application. The system integrates AI-powered recipe generation, ingredient lookup, and shopping cart automation with Kroger’s API. The initial version focuses on core functionalities, with future iterations planned for expanded store support, meal planning, and personalized recommendations.
