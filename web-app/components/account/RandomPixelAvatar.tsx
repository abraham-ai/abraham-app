"use client";
import React, { useEffect, useRef } from "react";

interface PixelAvatarProps {
  username: string;
  size?: number; // Default avatar size (in pixels)
  pixelSize?: number; // Number of pixels across and down for the avatar grid
}

const PixelAvatar: React.FC<PixelAvatarProps> = ({
  username,
  size = 64,
  pixelSize = 8,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hash the username to create a unique seed
  const hashUsername = (username: string): number => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = (hash << 5) - hash + username.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return hash;
  };

  // Generate a color from a seed
  const generateColor = (seed: number): string => {
    const r = (seed & 0xff0000) >> 16;
    const g = (seed & 0x00ff00) >> 8;
    const b = seed & 0x0000ff;
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Draw the pixel avatar
  const drawAvatar = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hash = Math.abs(hashUsername(username));

    // Calculate the size of each pixel block
    const gridSize = size / pixelSize;

    // Clear the canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Generate the pixel pattern based on the hash
    for (let x = 0; x < pixelSize; x++) {
      for (let y = 0; y < pixelSize; y++) {
        const seed = (hash >> (x * y)) & 0xffffff; // Create a unique seed for each pixel
        const color = generateColor(seed);

        // Fill half the grid symmetrically
        if (x < pixelSize / 2 || (x === pixelSize / 2 && y % 2 === 0)) {
          ctx.fillStyle = color;
          ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
          ctx.fillRect(
            (pixelSize - 1 - x) * gridSize,
            y * gridSize,
            gridSize,
            gridSize
          ); // Mirror it
        }
      }
    }
  };

  // Redraw avatar when username changes
  useEffect(() => {
    drawAvatar();
  }, [username]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ imageRendering: "pixelated", border: "1px solid black" }}
        className="rounded-full"
      ></canvas>
    </div>
  );
};

export default PixelAvatar;
