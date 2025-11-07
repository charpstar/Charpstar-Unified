# Product Grouping & Organization Plan

## Overview

Organize products in the spreadsheet by grouping similar products (variations of the same base product - colors, sizes, materials, etc.) together for better organization and easier review.

## Goals

1. **Detect Product Groups**: Identify products that are variations of the same base model
2. **Extract Variations**: Identify variation attributes (color, size, material, etc.)
3. **Visual Grouping**: Display grouped products together with visual indicators
4. **Smart Reorganization**: Automatically reorganize rows to show groups together

## Implementation Plan

### Phase 1: AI-Powered Product Analysis (Backend API)

**File**: `app/api/csv/group-products/route.ts`

**Functionality**:

- Use Gemini AI to analyze product names and identify:
  - Base product names (e.g., "Wardrobe PARIS 120" from "Wardrobe PARIS 120 White")
  - Variation types (Color, Size, Material, Finish, etc.)
  - Variation values (White, Black, 120cm, 160cm, Oak, etc.)
- Group products with similar base names
- Calculate similarity scores between products

**API Request**:

```typescript
{
  products: Array<{
    rowIndex: number;
    articleId: string;
    productName: string;
    category?: string;
    subcategory?: string;
  }>;
}
```

**API Response**:

```typescript
{
  groups: Array<{
    groupId: string;
    baseProductName: string;
    products: Array<{
      rowIndex: number;
      articleId: string;
      productName: string;
      variationAttributes: {
        type: "color" | "size" | "material" | "finish" | "other";
        value: string;
      }[];
      confidence: number;
    }>;
    variationTypes: string[];
  }>;
  ungrouped: Array<{
    rowIndex: number;
    articleId: string;
    productName: string;
  }>;
}
```

### Phase 2: Product Grouping Service

**File**: `lib/productGroupingService.ts`

**Functions**:

1. `analyzeProductName(productName: string)`
   - Extract base name and variations
   - Use pattern matching and AI if needed

2. `groupProducts(products: Product[])`
   - Calculate similarity between products
   - Group products with high similarity
   - Extract variation attributes

3. `reorganizeSpreadsheet(spreadsheetData, groups)`
   - Reorder rows to show groups together
   - Maintain header row
   - Add group indicators

### Phase 3: UI Components

#### 3.1 Group Organization Button

**Location**: Toolbar above spreadsheet

**Design**:

- Button: "Organize Products" with grouping icon
- Shows loading state during analysis
- Dropdown menu:
  - "Group by Similarity" (AI-powered)
  - "Group by Category"
  - "Group by Variation Type"

#### 3.2 Visual Group Indicators

**Location**: Spreadsheet rows

**Design**:

- **Group Header Row** (optional):
  - Background: Light blue gradient
  - Text: "Wardrobe PARIS 120 (5 variations)"
  - Expand/collapse icon
  - Show variation types: 🎨 Colors | 📏 Sizes | 🪵 Materials

- **Grouped Rows**:
  - Subtle left border in primary color
  - Slightly indented or background tint
  - Group number badge in first column

- **Variation Badges**:
  - Small colored badges next to product name
  - Color: 🟦 White, 🟥 Black
  - Size: 📏 120cm, 📏 160cm

#### 3.3 Group Summary Panel

**Location**: Above or beside spreadsheet

**Design**:

- Shows: "3 product groups found"
- Expandable list:
  - Group 1: "Wardrobe PARIS 120" (5 variations) [View/Edit]
  - Group 2: "Sofa MONTANA" (3 variations) [View/Edit]
  - Group 3: "Table OAK" (2 variations) [View/Edit]

### Phase 4: Spreadsheet Reorganization

**Algorithm**:

1. Keep header row at top
2. For each group:
   - Add optional group header row (if enabled)
   - Add all products in the group (sorted by variation)
   - Add subtle separator row (optional)
3. Add ungrouped products at the end

**Row Metadata**:

- Store group information in row metadata (not visible cells)
- Maintain original row index for undo functionality

### Phase 5: User Controls

#### 5.1 Grouping Options

- **Auto-group on paste**: Automatically group after data is pasted
- **Group threshold**: Slider for similarity threshold (0.7-0.95)
- **Show group headers**: Toggle to show/hide group header rows
- **Sort within groups**: By variation type, alphabetically, etc.

#### 5.2 Group Management

- **Expand/Collapse**: Click to expand/collapse groups
- **Ungroup**: Remove grouping for specific products
- **Merge Groups**: Combine two groups
- **Split Group**: Remove a product from its group

#### 5.3 Undo/Redo

- Store spreadsheet state before grouping
- Allow undo grouping operation
- Maintain history for multiple undo levels

## Technical Details

### AI Prompt for Product Grouping

```
Analyze these products and group them by base model, identifying variations:

Products:
{product list with row indices}

Task:
1. Identify base product names (e.g., "Wardrobe PARIS 120" from "Wardrobe PARIS 120 White")
2. Group products with the same base name
3. Extract variation attributes for each product:
   - Type: color, size, material, finish, etc.
   - Value: specific variation (White, 120cm, Oak, etc.)
4. Calculate confidence score (0-1) for each grouping

Return JSON:
{
  "groups": [
    {
      "groupId": "group_1",
      "baseProductName": "Wardrobe PARIS 120",
      "products": [
        {
          "rowIndex": 2,
          "articleId": "001_Wardrobe",
          "productName": "Wardrobe PARIS 120 White",
          "variationAttributes": [
            {"type": "color", "value": "White"}
          ],
          "confidence": 0.95
        }
      ],
      "variationTypes": ["color"]
    }
  ],
  "ungrouped": []
}
```

### Pattern Matching Rules (Fallback)

1. **Extract Base Name**:
   - Remove common color words: White, Black, Red, etc.
   - Remove size indicators: 120cm, 160cm, Small, Large, etc.
   - Remove material words: Oak, Pine, Metal, etc.
   - Use word similarity (Levenshtein distance)

2. **Detect Variations**:
   - Color: Match against color list
   - Size: Match against size patterns (120cm, Small, etc.)
   - Material: Match against material list

## File Structure

```
charpstar-unified/
├── app/api/csv/group-products/
│   └── route.ts                    # API endpoint for grouping
├── lib/
│   ├── productGroupingService.ts   # Grouping logic
│   └── productVariationDetector.ts # Variation detection
└── components/product-entry/
    ├── SpreadsheetProductEntry.tsx # Main component (update)
    ├── ProductGroupHeader.tsx      # Group header row component
    ├── VariationBadge.tsx          # Variation badge component
    └── GroupSummaryPanel.tsx       # Group summary sidebar
```

## Implementation Steps

1. ✅ Create AI-powered grouping API endpoint
2. ✅ Implement product grouping service
3. ✅ Add "Organize Products" button to toolbar
4. ✅ Implement visual group indicators in spreadsheet
5. ✅ Add group header rows (optional)
6. ✅ Implement expand/collapse functionality
7. ✅ Add group summary panel
8. ✅ Add undo/redo for grouping
9. ✅ Add grouping options/settings
10. ✅ Test with various product datasets

## Example Output

### Before Grouping:

```
Row 2: 001_Wardrobe | Wardrobe PARIS 120 White
Row 5: 004_Sofa | Sofa MONTANA Black
Row 3: 002_Wardrobe | Wardrobe PARIS 120 Black
Row 6: 005_Sofa | Sofa MONTANA Brown
Row 4: 003_Wardrobe | Wardrobe PARIS 120 Oak
```

### After Grouping:

```
Row 2: [GROUP] Wardrobe PARIS 120 (3 variations) 🎨 Colors
Row 3:   001_Wardrobe | Wardrobe PARIS 120 White 🟦
Row 4:   002_Wardrobe | Wardrobe PARIS 120 Black 🟥
Row 5:   003_Wardrobe | Wardrobe PARIS 120 Oak 🟫

Row 6: [GROUP] Sofa MONTANA (2 variations) 🎨 Colors
Row 7:   004_Sofa | Sofa MONTANA Black 🟥
Row 8:   005_Sofa | Sofa MONTANA Brown 🟫
```

## Future Enhancements

- Drag and drop to manually adjust groups
- Export grouped view to CSV
- Import grouping rules from previous sessions
- Machine learning model training on grouping patterns
- Collaborative grouping (multiple users)



