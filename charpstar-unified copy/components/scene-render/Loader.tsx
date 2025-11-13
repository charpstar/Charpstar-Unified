import React, { useState, useEffect } from "react";

const messages = [
  "Generating scene...",
  "Rendering lighting and materials...",
  "Applying realistic textures...",
  "Optimizing image quality...",
  "Upscaling to high resolution...",
  "Finalizing your scene...",
];

const Loader: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full items-center justify-center p-8 glass-card rounded-2xl shadow-2xl text-center animate-fade-in">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <h2 className="text-2xl font-bold text-gray-100">Creating Your Scene</h2>
      <p className="text-gray-400 mt-2 transition-opacity duration-500 h-6">
        {messages[messageIndex]}
      </p>
    </div>
  );
};

export default Loader;
