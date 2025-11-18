import React, { useState, useEffect } from "react";

const messages = [
  "Generating video scene...",
  "Analyzing product composition...",
  "Applying cinematic camera movements...",
  "Rendering realistic lighting and shadows...",
  "Processing video frames...",
  "Optimizing video quality...",
  "Finalizing your video...",
];

const VideoLoader: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full items-center justify-center p-8 glass-card rounded-2xl shadow-2xl text-center animate-fade-in">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
      <h2 className="text-2xl font-bold text-foreground">Creating Your Video</h2>
      <p className="text-muted-foreground mt-2 transition-opacity duration-500 h-6">
        {messages[messageIndex]}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-4">
        This may take 1-2 minutes...
      </p>
    </div>
  );
};

export default VideoLoader;

