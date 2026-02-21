// Extract dominant colors from an image and create a gradient
export function extractColorsFromImage(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve('241,245,249,226,232,240'); // Default slate colors as RGB
          return;
        }

        // Scale down for performance
        const scale = 0.15;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Sample colors from different regions (more samples for better accuracy)
        const samplePoints = [
          { x: canvas.width * 0.1, y: canvas.height * 0.1 }, // Top-left
          { x: canvas.width * 0.9, y: canvas.height * 0.1 }, // Top-right
          { x: canvas.width * 0.5, y: canvas.height * 0.3 }, // Upper center
          { x: canvas.width * 0.5, y: canvas.height * 0.7 }, // Lower center
          { x: canvas.width * 0.1, y: canvas.height * 0.9 }, // Bottom-left
          { x: canvas.width * 0.9, y: canvas.height * 0.9 }, // Bottom-right
        ];

        const colors: number[][] = [];
        samplePoints.forEach(point => {
          const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
          const [r, g, b] = pixel.data;
          colors.push([r, g, b]);
        });

        // Calculate average color
        const avgColor = colors.reduce(
          (acc, color) => [acc[0] + color[0], acc[1] + color[1], acc[2] + color[2]],
          [0, 0, 0]
        ).map(sum => Math.floor(sum / colors.length));

        // Create a slightly darker/lighter complementary color for gradient
        // Lighten one direction, darken the other
        const lighten = (color: number[]) => [
          Math.min(255, Math.floor(color[0] * 1.2)),
          Math.min(255, Math.floor(color[1] * 1.2)),
          Math.min(255, Math.floor(color[2] * 1.2)),
        ];

        const darken = (color: number[]) => [
          Math.max(0, Math.floor(color[0] * 0.7)),
          Math.max(0, Math.floor(color[1] * 0.7)),
          Math.max(0, Math.floor(color[2] * 0.7)),
        ];

        // Use lighter and darker versions for gradient
        const color1 = lighten(avgColor);
        const color2 = darken(avgColor);

        // Return as RGB values separated by commas: "r1,g1,b1,r2,g2,b2"
        resolve(`${color1[0]},${color1[1]},${color1[2]},${color2[0]},${color2[1]},${color2[2]}`);
      } catch (err) {
        console.error('Error extracting colors:', err);
        resolve('241,245,249,226,232,240'); // Default slate colors
      }
    };

    img.onerror = () => {
      resolve('241,245,249,226,232,240'); // Default slate colors
    };

    img.src = imageUrl;
  });
}
