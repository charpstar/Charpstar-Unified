/**
 * Seed script to populate the texture library with sample textures
 * Run with: npx tsx scripts/seed-textures.ts
 */

import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sampleTextures = [
  {
    name: "Allie02 Fabric",
    category: "Fabric",
    basecolor_url:
      "https://drive.charpstar.net/textures/fabric/plain/allie02_basecolor.jpg",
    roughness_url:
      "https://drive.charpstar.net/textures/fabric/plain/allie02_roughness.jpg",
    metallic_url:
      "https://drive.charpstar.net/textures/fabric/plain/allie02_metallic.jpg",
    normal_url:
      "https://drive.charpstar.net/textures/fabric/plain/allie02_normal.jpg",
    preview_url:
      "https://drive.charpstar.net/textures/fabric/plain/allie02_preview.png",
    is_public: true,
  },
  {
    name: "Oak Wood Planks",
    category: "Wood",
    basecolor_url: "https://example.com/textures/wood/oak_basecolor.jpg",
    roughness_url: "https://example.com/textures/wood/oak_roughness.jpg",
    metallic_url: "https://example.com/textures/wood/oak_metallic.jpg",
    normal_url: "https://example.com/textures/wood/oak_normal.jpg",
    preview_url: "https://example.com/textures/wood/oak_preview.png",
    is_public: true,
  },
  {
    name: "Brushed Steel",
    category: "Metal",
    basecolor_url: "https://example.com/textures/metal/steel_basecolor.jpg",
    roughness_url: "https://example.com/textures/metal/steel_roughness.jpg",
    metallic_url: "https://example.com/textures/metal/steel_metallic.jpg",
    normal_url: "https://example.com/textures/metal/steel_normal.jpg",
    preview_url: "https://example.com/textures/metal/steel_preview.png",
    is_public: true,
  },
  {
    name: "White Marble",
    category: "Stone",
    basecolor_url: "https://example.com/textures/stone/marble_basecolor.jpg",
    roughness_url: "https://example.com/textures/stone/marble_roughness.jpg",
    metallic_url: "https://example.com/textures/stone/marble_metallic.jpg",
    normal_url: "https://example.com/textures/stone/marble_normal.jpg",
    preview_url: "https://example.com/textures/stone/marble_preview.png",
    is_public: true,
  },
  {
    name: "Red Brick Wall",
    category: "Wall",
    basecolor_url: "https://example.com/textures/wall/brick_basecolor.jpg",
    roughness_url: "https://example.com/textures/wall/brick_roughness.jpg",
    metallic_url: "https://example.com/textures/wall/brick_metallic.jpg",
    normal_url: "https://example.com/textures/wall/brick_normal.jpg",
    preview_url: "https://example.com/textures/wall/brick_preview.png",
    is_public: true,
  },
  {
    name: "Cotton Canvas",
    category: "Fabric",
    basecolor_url: "https://example.com/textures/fabric/canvas_basecolor.jpg",
    roughness_url: "https://example.com/textures/fabric/canvas_roughness.jpg",
    metallic_url: "https://example.com/textures/fabric/canvas_metallic.jpg",
    normal_url: "https://example.com/textures/fabric/canvas_normal.jpg",
    preview_url: "https://example.com/textures/fabric/canvas_preview.png",
    is_public: true,
  },
  {
    name: "Leather Brown",
    category: "Fabric",
    basecolor_url: "https://example.com/textures/leather/brown_basecolor.jpg",
    roughness_url: "https://example.com/textures/leather/brown_roughness.jpg",
    metallic_url: "https://example.com/textures/leather/brown_metallic.jpg",
    normal_url: "https://example.com/textures/leather/brown_normal.jpg",
    preview_url: "https://example.com/textures/leather/brown_preview.png",
    is_public: true,
  },
  {
    name: "Concrete Rough",
    category: "Stone",
    basecolor_url: "https://example.com/textures/concrete/rough_basecolor.jpg",
    roughness_url: "https://example.com/textures/concrete/rough_roughness.jpg",
    metallic_url: "https://example.com/textures/concrete/rough_metallic.jpg",
    normal_url: "https://example.com/textures/concrete/rough_normal.jpg",
    preview_url: "https://example.com/textures/concrete/rough_preview.png",
    is_public: true,
  },
];

async function seedTextures() {
  console.log("🌱 Seeding textures...");

  try {
    // Check if textures table exists
    const { data: existingTextures, error: checkError } = await supabase
      .from("textures")
      .select("id")
      .limit(1);

    if (checkError) {
      console.error("❌ Error checking textures table:", checkError);
      console.log("Please ensure you've run the migration first:");
      console.log("  supabase db push");
      return;
    }

    // Insert sample textures
    const { data, error } = await supabase
      .from("textures")
      .insert(sampleTextures)
      .select();

    if (error) {
      console.error("❌ Error seeding textures:", error);
      return;
    }

    console.log(`✅ Successfully seeded ${data?.length || 0} textures`);
    console.log("Sample textures:");
    data?.forEach((texture) => {
      console.log(`  - ${texture.name} (${texture.category})`);
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

seedTextures();
