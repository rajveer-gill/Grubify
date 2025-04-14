// App.js
import React from 'react';
import { Toaster } from 'react-hot-toast';
import NutrifyAI from './NutrifyAI';

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" />
      <NutrifyAI />
    </div>
  );
}

export default App;
