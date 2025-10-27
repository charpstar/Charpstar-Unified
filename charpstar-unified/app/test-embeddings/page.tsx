"use client";

import { useState } from 'react';

export default function TestEmbeddingsPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testDatabase = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/embeddings/test');
      const data = await response.json();
      setResults({ test: 'database', result: data });
    } catch (error) {
      setResults({ test: 'database', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  const testEmbedding = async () => {
    setLoading(true);
    try {
      // First create a test asset
      const createResponse = await fetch('/api/embeddings/create-test-asset', {
        method: 'POST'
      });
      const createData = await createResponse.json();
      
      if (!createData.success) {
        setResults({ test: 'embedding', error: createData.error });
        setLoading(false);
        return;
      }
      
      // Then test embedding generation with the created asset
      const response = await fetch('/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: createData.assetId,
          imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&h=500&fit=crop',
          imageType: 'product_image'
        })
      });
      const data = await response.json();
      setResults({ test: 'embedding', result: data });
    } catch (error) {
      setResults({ test: 'embedding', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  const testScraping = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/embeddings/scrape-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl: 'https://example.com/product'
        })
      });
      const data = await response.json();
      setResults({ test: 'scraping', result: data });
    } catch (error) {
      setResults({ test: 'scraping', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  const testSimilarity = async () => {
    setLoading(true);
    try {
      // First create a test asset and embedding, then search
      const createResponse = await fetch('/api/embeddings/create-test-asset', {
        method: 'POST'
      });
      const createData = await createResponse.json();
      
      if (!createData.success) {
        setResults({ test: 'similarity', error: createData.error });
        setLoading(false);
        return;
      }
      
      // Generate embedding for the test asset with a landscape image
      const embeddingResponse = await fetch('/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: createData.assetId,
          imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=500&fit=crop', // Mountain landscape
          imageType: 'product_image'
        })
      });
      
      if (!embeddingResponse.ok) {
        setResults({ test: 'similarity', error: 'Failed to generate embedding' });
        setLoading(false);
        return;
      }
      
      // Now test similarity search
      const response = await fetch('/api/embeddings/similarity-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: createData.assetId, // Use the asset ID, not embedding ID
          k: 3
        })
      });
      const data = await response.json();
      setResults({ test: 'similarity', result: data });
    } catch (error) {
      setResults({ test: 'similarity', error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Embeddings API</h1>
      
      <div className="space-y-4">
        <button 
          onClick={testDatabase}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Test Database Connection
        </button>
        
        <button 
          onClick={testEmbedding}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Test Embedding Generation
        </button>
        
        <button 
          onClick={testScraping}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
        >
          Test Image Scraping
        </button>
        
        <button 
          onClick={testSimilarity}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 text-white rounded disabled:opacity-50"
        >
          Test Similarity Search
        </button>
      </div>

      {results && (
        <div className="mt-8 p-4 bg-gray-100 rounded">
          <h3 className="font-bold">Test: {results.test}</h3>
          <pre className="mt-2 text-sm overflow-auto">
            {JSON.stringify(results.result || results.error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
