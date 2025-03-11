#!/bin/bash
echo "installing npm"
brew install npm

echo "entering virtual environment"
cd backend
python3 -m venv venv
source venv/bin/activate

echo "installing python requirements"
pip install -r requirements.txt

cd ..

echo "installing npm dependencies in /frontend..."
cd frontend
npm install

cd ..
cd backend
echo "running backend"
python3 app.py &
cd ../frontend
npm start
