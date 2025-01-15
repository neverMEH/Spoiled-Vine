import React from 'react';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-background text-foreground">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold">Spoiled Vine</h1>
            <p className="mt-4">Your premier wine review platform</p>
          </div>
        </div>
      } />
    </Routes>
  );
}

export default App;