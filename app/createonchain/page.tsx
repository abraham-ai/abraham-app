"use client";

import React, { useState } from "react";

export default function CreateCreationPage() {
  const [image, setImage] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !description) {
      alert("Please provide an image and description");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Convert image to base64 data URL
      const base64DataURL = await fileToBase64(image);

      const response = await fetch("/api/onchain/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          imageBase64: base64DataURL,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create creation on-chain");
      }

      const data = await response.json();
      console.log("Creation created successfully:", data);
      setResult(data);
    } catch (err: any) {
      console.error("Error creating creation:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Create a New Creation</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block font-medium mb-1">Image:</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setImage(e.target.files[0]);
              }
            }}
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border p-2 w-full"
            rows={3}
          ></textarea>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </form>

      {error && (
        <div className="mt-4 text-red-600">
          <p>Error: {error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 text-green-600">
          <h2 className="font-semibold mb-1">Creation Created Successfully:</h2>
          <p>
            <strong>Transaction Hash:</strong> {result.txHash}
          </p>

          <p>
            <strong>Image IPFS:</strong> {result.image_ipfs}
          </p>
          <p>
            <strong>Metadata IPFS:</strong> {result.metadata_ipfs}
          </p>
          <p>{result.message}</p>
        </div>
      )}
    </div>
  );
}
