# Grubify

Grubify is an application allowing users to create recipes, store them in an organized way, and add them to their cart in the Kroger online store. The system is made up of the frontend written in Node.js and React which handles the user facing UI and the backend written in Python. The frontend and backend are connected through an API where the frontend can call functions in the backend.

## Installation Instructions

Requirements:
 - homebrew
 - python 3.x

1. Make install-run.sh executable with chmod 755 install-run.sh
2. Run the script with ./install-run.sh

## Using Nutrify

In the web window that opens upon running Nutrify, enter the name of the recipe and click the search icon. When the recipe loads, the user can view the ingredients on the left and the instructions on the right. To add to cart, click the log in to Kroger button on the left side and continue on the Kroger website. Deselect ingredients you already have by clicking the checkmark and then click order with Kroger. To save the recipe, click Save to my recipes and view it in the Recipe history menu.

## Directory Structure

```bash
.
├── LICENSE
├── README.md
├── install-run.sh
├── backend/
├── docs/
└── frontend/
```

## Authors
Raj Gill, John Moore, Tim Nikolaev, Manu Shukla, Myles Vigil

## Requirements
Flask, openai, python-dotenv, requests, selenium, flask-cors, autoprefixer, lucide-react, postcss, react, react-dom, react-scripts, tailwindcss, web-vitals
