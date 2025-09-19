import React, { useState, useEffect } from "react";
import Image from "next/image";

interface ResultDisplayProps {
  images: string[];
  onReset: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ images, onReset }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedImageUrl = `data:image/png;base64,${images[selectedIndex]}`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

  return (
    <>
      <div className="w-full max-w-3xl flex flex-col items-center glass-card p-6 rounded-2xl shadow-2xl animate-fade-in">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          Your Scene Gallery is Ready!
        </h2>
        <p className="text-muted-foreground mb-6">
          Click a thumbnail below to view, fullscreen, or download.
        </p>

        <div
          className="w-full max-w-xl aspect-square rounded-lg overflow-hidden border border-gray-700 mb-6 shadow-inner cursor-zoom-in group"
          onClick={() => setIsModalOpen(true)}
          title="Click to view fullscreen"
          role="button"
          aria-label="View image fullscreen"
        >
          <Image
            src={selectedImageUrl}
            alt={`Generated product scene ${selectedIndex + 1}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            width={640}
            height={360}
          />
        </div>

        <div className="flex justify-center space-x-3 mb-8">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`w-20 h-20 rounded-md overflow-hidden border-2 transition-all duration-200 ${selectedIndex === index ? "border-blue-500 scale-110" : "border-gray-600 hover:border-gray-400"}`}
              aria-label={`Select image ${index + 1}`}
            >
              <Image
                src={`data:image/png;base64,${img}`}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                width={64}
                height={64}
              />
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <a
            href={selectedImageUrl}
            download={`generated-scene-${selectedIndex + 1}.png`}
            className="btn btn-primary text-center"
          >
            Download Image
          </a>
          <button onClick={onReset} className="btn btn-secondary">
            Create Another
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors z-10"
            aria-label="Close fullscreen view"
          >
            &times;
          </button>
          <div className="p-4" onClick={(e) => e.stopPropagation()}>
            <Image
              src={selectedImageUrl}
              alt="Generated product scene in fullscreen"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              width={640}
              height={360}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ResultDisplay;
