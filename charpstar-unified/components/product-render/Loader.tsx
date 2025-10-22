import React, { useState, useEffect } from "react";

const messages = [
  "Analyzing product textures...",
  "Conceptualizing your perfect product render...",
  "Setting up virtual product photoshoot...",
  "Rendering lighting and environment...",
  "Applying photorealistic details...",
  "Upscaling with Cloudinary AI...",
  "Finalizing your premium product image...",
];

const Loader: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 glass-card rounded-2xl shadow-2xl text-center animate-fade-in">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <h2 className="text-2xl font-bold text-gray-100">
        Generating Your Product Render
      </h2>
      <p className="text-gray-400 mt-2 transition-opacity duration-500 h-6">
        {messages[messageIndex]}
      </p>
    </div>
  );
};

export default Loader;

