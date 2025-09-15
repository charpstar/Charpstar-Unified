// Swedish to English color/material translation map
const swedishToEnglishMap: Record<string, string> = {
  // Basic Colors
  blå: "blue",
  blått: "blue",
  röd: "red",
  rött: "red",
  grön: "green",
  grönt: "green",
  gul: "yellow",
  gult: "yellow",
  svart: "black",
  vit: "white",
  vitt: "white",
  grå: "gray",
  grått: "gray",
  brun: "brown",
  brunt: "brown",
  orange: "orange",
  lila: "purple",
  rosa: "pink",
  guld: "gold",
  guldfärgad: "gold",
  silver: "silver",
  silverfärgad: "silver",
  krom: "chrome",
  kromad: "chrome",
  koppar: "copper",
  kopparfärgad: "copper",
  beige: "beige",
  beigefärgad: "beige",
  turkos: "turquoise",
  turkosfärgad: "turquoise",
  transparent: "transparent",
  genomskinlig: "transparent",

  // Color variations and modifiers
  mörk: "dark",
  ljus: "light",
  mörkblå: "dark blue",
  ljusblå: "light blue",
  mörkgrön: "dark green",
  ljusgrön: "light green",
  mörkgrå: "dark gray",
  ljusgrå: "light gray",
  mörkbrun: "dark brown",
  ljusbrun: "light brown",
  mörkröd: "dark red",
  ljusröd: "light red",

  // Specific color names from database
  antracit: "anthracite",
  antracitgrå: "anthracite gray",
  ask: "ash",
  björk: "birch",
  speckled: "speckled",
  striped: "striped",
  gradient: "gradient",
  mirror: "mirror",
  brushed: "brushed",
  aluminium: "aluminium",
  gunmetal: "gunmetal",
  arista: "arista",

  // Materials
  trä: "wood",
  metall: "metal",
  glas: "glass",
  plast: "plastic",
  sten: "stone",
  läder: "leather",
  ull: "wool",
  bomull: "cotton",
  keramik: "ceramic",

  konstläder: "artificial leather",
  artificial_leather: "artificial leather",
  faux_leather: "artificial leather", // treat as same
  läderimitation: "artificial leather",
  fauxläder: "artificial leather",
  stål: "steel",
  steel: "steel",
  Steel: "steel",

  metal: "metal",
  metallic: "metal",
  mässing: "brass",
  brass: "brass",
  betong: "concrete",
  concrete: "concrete",
  kork: "cork",
  cork: "cork",
  tyg: "fabric",
  textil: "fabric",
  fabric: "fabric",
  nylon: "nylon",
  nylonm: "nylon",
  vinyl: "vinyl",
  gummi: "rubber",
  rubber: "rubber",

  glass: "glass",
  plastic: "plastic",
  PVC: "PVC",
  wood: "wood",
  träben: "wooden legs",
  wooden_legs: "wooden legs",
  birch: "birch",
  ek: "oak",
  oak: "oak",
  furu: "pine",
  pine: "pine",
  ash: "ash",
  fanér: "veneer",
  veneer: "veneer",
  skiva: "board",
  hardened_board: "hardened board",
  MDF: "MDF",
  papper: "paper",
  paper: "paper",
  ceramic: "ceramic",
  wool: "wool",
  cotton: "cotton",
  aluminum: "aluminium",
};

/**
 * Translates a Swedish search string to English equivalents if found in the map.
 * Returns a string with both the original and translated terms for broader matching.
 */
export function translateSwedishToEnglish(search: string): string {
  if (!search) return search;

  // Split by commas and spaces, then clean up
  const terms = search
    .split(/,|\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const translated = terms.map((term) => swedishToEnglishMap[term] || term);

  // Combine original and translated terms, removing duplicates
  const combined = Array.from(new Set([...terms, ...translated]));
  return combined.join(", ");
}
