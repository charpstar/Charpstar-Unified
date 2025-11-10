"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button, Label } from "@/components/ui/display";
import { Input, Textarea } from "@/components/ui/inputs";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/containers/dialog";
import { ViewReferencesDialog } from "@/components/ui/containers/ViewReferencesDialog";
import {
  Plus,
  ArrowLeft,
  Package,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  Loader2,
  X,
  Eye,
  AlertTriangle,
  FileText,
  Link as LinkIcon,
  Trash2,
  Copy,
} from "lucide-react";

import * as saveAs from "file-saver";

interface ProductForm {
  article_id: string;
  product_name: string;
  product_link: string;
  cad_file_link: string;
  category: string;
  subcategory: string;
  references: { type: "url" | "file"; value: string; file?: File }[];
  measurements?: { height: string; width: string; depth: string };
  is_parent?: boolean;
  variations?: ProductForm[]; // Array of variation products
  parent_article_id?: string; // For variations only
  variation_index?: number; // Index for variations
  additional_article_ids?: string[];
}

const STORAGE_KEY = "add-products-cache";

const normalizeArticleIdArray = (
  primary: string,
  additional: string[] = []
): string[] => {
  const values = new Set<string>();
  const pushValue = (value: string | undefined | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (trimmed) values.add(trimmed);
  };

  pushValue(primary);
  additional.forEach((value) => pushValue(value));

  return Array.from(values);
};

const normalizeProductForm = (product: ProductForm): ProductForm => ({
  ...product,
  additional_article_ids: Array.isArray(product.additional_article_ids)
    ? product.additional_article_ids
    : [],
  variations: product.variations
    ? product.variations.map((variation) =>
        normalizeProductForm({ ...variation })
      )
    : undefined,
});

const _buildArticleIdPayload = (product: ProductForm) => {
  const articleIds = normalizeArticleIdArray(
    product.article_id,
    product.additional_article_ids || []
  );

  const primary = articleIds[0] || product.article_id.trim();

  return {
    primary,
    articleIds,
  };
};

// Helper to serialize products for localStorage (removes File objects)
const serializeProducts = (products: ProductForm[]): ProductForm[] => {
  return products.map((product) => ({
    ...product,
    additional_article_ids: Array.isArray(product.additional_article_ids)
      ? [...product.additional_article_ids]
      : [],
    references: product.references.map((ref) => ({
      type: ref.type,
      value: ref.value,
      // Don't include file object - it can't be serialized
      // User will need to re-upload files if they navigate away
    })),
    variations: product.variations
      ? product.variations.map((variation) => ({
          ...variation,
          additional_article_ids: Array.isArray(
            variation.additional_article_ids
          )
            ? [...variation.additional_article_ids]
            : [],
          references: variation.references.map((ref) => ({
            type: ref.type,
            value: ref.value,
          })),
        }))
      : undefined,
  }));
};

// Helper to load from localStorage
const loadFromStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error);
  }
  return null;
};

// Helper to save to localStorage
const saveToStorage = (
  products: ProductForm[],
  expandedVariations: Set<number>
) => {
  if (typeof window === "undefined") return;
  try {
    const data = {
      products: serializeProducts(products),
      expandedVariations: Array.from(expandedVariations),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
};

// Helper to clear localStorage
const clearStorage = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing localStorage:", error);
  }
};

export default function AddProductsPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<number>(1);

  // Initialize products from localStorage if available
  const getInitialProducts = (): ProductForm[] => {
    if (typeof window === "undefined") {
      return [
        {
          article_id: "",
          product_name: "",
          product_link: "",
          cad_file_link: "",
          category: "",
          subcategory: "",
          references: [],
          measurements: undefined,
          additional_article_ids: [],
        },
      ];
    }

    const cached = loadFromStorage();
    if (cached && cached.products && cached.products.length > 0) {
      const cacheAge = Date.now() - (cached.timestamp || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge < maxAge) {
        const hasData = cached.products.some(
          (p: ProductForm) =>
            p.article_id.trim() ||
            p.product_name.trim() ||
            p.product_link.trim() ||
            p.references.length > 0
        );

        if (hasData) {
          return cached.products.map((product: ProductForm) =>
            normalizeProductForm(product)
          );
        }
      }
    }

    return [
      {
        article_id: "",
        product_name: "",
        product_link: "",
        cad_file_link: "",
        category: "",
        subcategory: "",
        references: [],
        measurements: undefined,
        additional_article_ids: [],
      },
    ];
  };

  const [products, setProducts] = useState<ProductForm[]>(getInitialProducts);
  const hasRestoredRef = useRef(false);

  // Check if we initialized from cache
  useEffect(() => {
    const cached = loadFromStorage();
    if (cached && cached.products && cached.products.length > 0) {
      const cacheAge = Date.now() - (cached.timestamp || 0);
      const maxAge = 24 * 60 * 60 * 1000;
      if (cacheAge < maxAge) {
        const hasData = cached.products.some(
          (p: ProductForm) =>
            p.article_id.trim() ||
            p.product_name.trim() ||
            p.product_link.trim() ||
            p.references.length > 0
        );
        if (hasData) {
          hasRestoredRef.current = true;
        }
      }
    }
    // Set to true after initial check to allow saving
    setTimeout(() => {
      hasRestoredRef.current = true;
    }, 100);
  }, []);
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCsvUploadConfirmDialog, setShowCsvUploadConfirmDialog] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvErrors, setCsvErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [csvWarnings, setCsvWarnings] = useState<
    {
      row: number;
      message: string;
      type: "duplicate_article_id" | "missing_fields";
    }[]
  >([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedCsvData, setEditedCsvData] = useState<string[][] | null>(null);
  //eslint-disable-next-line
  const [collectingImages, setCollectingImages] = useState(false);
  const [additionalArticleIdInputs, setAdditionalArticleIdInputs] = useState<
    Record<string, string>
  >({});
  const [articleIdDialogIndex, setArticleIdDialogIndex] = useState<
    number | null
  >(null);
  const [editingReferencesIndex, setEditingReferencesIndex] = useState<
    number | null
  >(null);
  const [editingVariationRef, setEditingVariationRef] = useState<{
    parentIndex: number;
    variationIndex: number;
  } | null>(null);
  const [showReferencesDialog, setShowReferencesDialog] = useState(false);
  const [showViewReferencesDialog, setShowViewReferencesDialog] =
    useState(false);
  const [viewingReferencesIndex, setViewingReferencesIndex] = useState<
    number | null
  >(null);
  const [viewingVariationRef, setViewingVariationRef] = useState<{
    parentIndex: number;
    variationIndex: number;
  } | null>(null);
  const [recentReferences, setRecentReferences] = useState<
    { type: "url" | "file"; value: string; file?: File }[]
  >([]);
  const [addMultipleProducts, setAddMultipleProducts] = useState("");
  const [_isVariationContracted, setIsVariationContracted] = useState(false);
  // Initialize expandedVariations from localStorage if available
  const getInitialExpandedVariations = (): Set<number> => {
    if (typeof window === "undefined") {
      return new Set();
    }

    const cached = loadFromStorage();
    if (
      cached &&
      cached.expandedVariations &&
      cached.expandedVariations.length > 0
    ) {
      return new Set(cached.expandedVariations);
    }

    return new Set();
  };

  const [expandedVariations, setExpandedVariations] = useState<Set<number>>(
    getInitialExpandedVariations
  );
  const [showAddVariationsDialog, setShowAddVariationsDialog] = useState(false);
  const [addVariationsParentIndex, setAddVariationsParentIndex] = useState<
    number | null
  >(null);
  const [variationsCount, setVariationsCount] = useState<string>("1");

  // Show restore notification if data was loaded from cache
  useEffect(() => {
    if (!pageLoading && !hasRestoredRef.current) {
      const cached = loadFromStorage();
      if (cached && cached.products && cached.products.length > 0) {
        const cacheAge = Date.now() - (cached.timestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (cacheAge < maxAge) {
          const hasData = cached.products.some(
            (p: ProductForm) =>
              p.article_id.trim() ||
              p.product_name.trim() ||
              p.product_link.trim() ||
              p.references.length > 0
          );

          if (hasData) {
            hasRestoredRef.current = true;
            toast.info("Restored your previous work", {
              description: "Your product data has been restored from cache.",
              duration: 4000,
            });
          }
        }
      }
      hasRestoredRef.current = true;
    }
  }, [pageLoading]);

  // Save to localStorage whenever products or expandedVariations change
  useEffect(() => {
    // Skip saving during initial restore
    if (!hasRestoredRef.current) return;

    // Skip initial empty state
    if (products.length === 0) return;

    // Check if there's any actual data to save
    const hasData = products.some(
      (p) =>
        p.article_id.trim() ||
        p.product_name.trim() ||
        p.product_link.trim() ||
        p.references.length > 0 ||
        (p.variations && p.variations.length > 0)
    );

    if (hasData) {
      saveToStorage(products, expandedVariations);
    } else {
      // Clear storage if form is empty
      clearStorage();
    }
  }, [products, expandedVariations]);

  // Fetch client variation contract status
  useEffect(() => {
    const fetchClientVariationStatus = async () => {
      if (!user?.metadata?.client) return;

      const clientName = Array.isArray(user.metadata.client)
        ? user.metadata.client[0]
        : user.metadata.client;

      const { data } = await supabase
        .from("clients")
        .select("variation_contracted")
        .eq("name", clientName)
        .single();

      setIsVariationContracted(data?.variation_contracted || false);
    };

    fetchClientVariationStatus();
  }, [user?.metadata?.client]);

  // Helper to check if a reference is an image
  const isImageReference = (ref: {
    type: "url" | "file";
    value: string;
    file?: File;
  }) => {
    if (ref.type === "file" && ref.file) {
      return ref.file.type.startsWith("image/");
    } else if (ref.type === "url") {
      const url = ref.value.toLowerCase();
      return url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
    }
    return false;
  };

  const addMultipleLinesFunction = () => {
    const numLines = parseInt(addMultipleProducts.trim());

    if (isNaN(numLines) || numLines <= 0) {
      toast.error("Please enter a valid number greater than 0");
      return;
    }

    if (numLines > 100) {
      toast.error("Maximum 100 lines can be added at once");
      return;
    }

    const newProducts = Array.from({ length: numLines }, () => ({
      article_id: "",
      product_link: "",
      cad_file_link: "",
      category: "",
      subcategory: "",
      references: [],
      product_name: "",
      measurements: undefined,
    }));

    setProducts((prev) => [...prev, ...newProducts]);
    setAddMultipleProducts("");

    toast.success(
      `Added ${numLines} empty product row${numLines === 1 ? "" : "s"}`
    );
  };

  // Helper to get preview URL for an image
  const getImagePreviewUrl = (ref: {
    type: "url" | "file";
    value: string;
    file?: File;
  }) => {
    if (ref.type === "file" && ref.file) {
      return URL.createObjectURL(ref.file);
    } else if (ref.type === "url") {
      return ref.value;
    }
    return null;
  };

  // Helper to add reference to recent list
  const addToRecent = (ref: {
    type: "url" | "file";
    value: string;
    file?: File;
  }) => {
    setRecentReferences((prev) => {
      // Check if already exists
      const exists = prev.some((r) => r.value === ref.value);
      if (exists) return prev;

      // Add to beginning, keep last 5
      return [ref, ...prev].slice(0, 5);
    });
  };

  // Helper function to reset file input
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      // Force a small delay to ensure the browser processes the reset
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 10);
    }
  };

  // Function to collect images for the client
  const collectImages = async () => {
    if (!user?.metadata?.client) {
      console.warn("Client information not available for image collection");
      return;
    }

    setCollectingImages(true);

    try {
      // Use first company if user has multiple
      const clientName = Array.isArray(user.metadata.client)
        ? user.metadata.client[0]
        : user.metadata.client;

      if (!clientName) {
        throw new Error("No client name configured for this user");
      }

      const response = await fetch(
        `https://scraper.charpstar.co/process-client/${encodeURIComponent(clientName)}`,
        {
          method: "POST",
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(30000), // 30 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
    } catch (error) {
      console.error("Error collecting images:", error);
      console.warn(
        "Image collection failed silently - this won't affect your product upload"
      );
    } finally {
      setCollectingImages(false);
    }
  };

  // Fetch current batch number for this client
  useEffect(() => {
    async function fetchCurrentBatch() {
      if (!user?.metadata?.client) return;

      startLoading();
      try {
        let query = supabase
          .from("onboarding_assets")
          .select("batch")
          .order("batch", { ascending: false })
          .limit(1);

        // Filter by user's companies
        if (
          Array.isArray(user.metadata.client) &&
          user.metadata.client.length > 0
        ) {
          query = query.in("client", user.metadata.client);
        }

        const { data, error } = await query;

        if (!error && data && data.length > 0) {
          setCurrentBatch(data[0].batch + 1);
        } else {
          setCurrentBatch(1);
        }
      } catch (error) {
        console.error("Error fetching current batch:", error);
        setCurrentBatch(1);
      } finally {
        setPageLoading(false);
        stopLoading();
      }
    }

    fetchCurrentBatch();
  }, [user?.metadata?.client]);

  const _addProduct = () => {
    setProducts([
      ...products,
      {
        article_id: "",
        product_name: "",
        product_link: "",
        cad_file_link: "",
        category: "",
        subcategory: "",
        references: [],
        measurements: undefined,
        additional_article_ids: [],
      },
    ]);
  };

  const _removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const _copyProduct = (index: number) => {
    const productToCopy = products[index];

    // Deep copy the product
    const copiedProduct: ProductForm = {
      ...productToCopy,
      article_id: "", // Clear article ID so user has to change it
      additional_article_ids: [],
      // Deep copy references (without File objects - they'll need to re-upload)
      references: productToCopy.references.map((ref) => ({
        type: ref.type,
        value: ref.value,
        // Don't copy file objects - user needs to re-upload
      })),
      // Deep copy variations if they exist
      variations: productToCopy.variations
        ? productToCopy.variations.map((variation) => ({
            ...variation,
            article_id: "", // Clear article ID for variations too
            additional_article_ids: [],
            references: variation.references.map((ref) => ({
              type: ref.type,
              value: ref.value,
            })),
          }))
        : undefined,
      // Reset variation index for copied product
      variation_index: undefined,
      parent_article_id: undefined,
    };

    // Insert the copied product right after the original
    const updatedProducts = [...products];
    updatedProducts.splice(index + 1, 0, copiedProduct);
    setProducts(updatedProducts);

    // If the original product had expanded variations, expand them for the copy too
    if (
      productToCopy.is_parent &&
      productToCopy.variations &&
      productToCopy.variations.length > 0
    ) {
      setExpandedVariations(new Set([...expandedVariations, index + 1]));
    }

    toast.success("Product row copied", {
      description: "Remember to update the article ID.",
      duration: 3000,
    });
  };

  const getAdditionalInputKey = (
    type: "product" | "variation",
    productIndex: number,
    variationIndex?: number
  ) =>
    type === "product"
      ? `product-${productIndex}`
      : `variation-${productIndex}-${variationIndex ?? 0}`;

  const parseAdditionalArticleInput = (rawValue: string) =>
    rawValue
      .split(/[\s,;\n]+/)
      .map((id) => id.trim())
      .filter(Boolean);

  const _updateProduct = (
    index: number,
    field: keyof ProductForm,
    value: string | number | boolean
  ) => {
    setProducts((prev) => {
      const updatedProducts = [...prev];
      const current = { ...updatedProducts[index], [field]: value };

      if (field === "article_id" && typeof value === "string") {
        const normalized = normalizeArticleIdArray(
          value,
          current.additional_article_ids || []
        );
        current.additional_article_ids = normalized.filter(
          (id) => id !== value.trim()
        );
      }

      updatedProducts[index] = current;
      return updatedProducts;
    });
  };

  const addAdditionalArticleIdsToProduct = (
    productIndex: number,
    rawValue: string
  ) => {
    const entries = parseAdditionalArticleInput(rawValue);
    if (entries.length === 0) return;

    setProducts((prev) => {
      const next = [...prev];
      const product = { ...next[productIndex] };
      const additional = Array.isArray(product.additional_article_ids)
        ? [...product.additional_article_ids]
        : [];

      const normalized = normalizeArticleIdArray(product.article_id, [
        ...additional,
        ...entries,
      ]);

      product.additional_article_ids = normalized.filter(
        (id) => id !== product.article_id.trim()
      );

      next[productIndex] = product;
      return next;
    });
  };
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeAdditionalArticleIdFromProduct = (
    productIndex: number,
    articleId: string
  ) => {
    setProducts((prev) => {
      const next = [...prev];
      const product = { ...next[productIndex] };
      const additional = Array.isArray(product.additional_article_ids)
        ? product.additional_article_ids.filter((id) => id !== articleId)
        : [];

      product.additional_article_ids = additional;
      next[productIndex] = product;
      return next;
    });
  };

  const handleAdditionalArticleIdInputChange = (key: string, value: string) => {
    setAdditionalArticleIdInputs((prev) => ({ ...prev, [key]: value }));
  };

  const commitAdditionalArticleIdsForProduct = (productIndex: number) => {
    const key = getAdditionalInputKey("product", productIndex);
    const rawValue = additionalArticleIdInputs[key]?.trim();
    if (!rawValue) return false;

    addAdditionalArticleIdsToProduct(productIndex, rawValue);
    setAdditionalArticleIdInputs((prev) => ({ ...prev, [key]: "" }));
    return true;
  };

  const clearAdditionalArticleIdsForProduct = (productIndex: number) => {
    setProducts((prev) => {
      const next = [...prev];
      const product = { ...next[productIndex] };
      product.additional_article_ids = [];
      next[productIndex] = product;
      return next;
    });

    const key = getAdditionalInputKey("product", productIndex);
    setAdditionalArticleIdInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const _handleOpenArticleIdDialog = (productIndex: number) => {
    const key = getAdditionalInputKey("product", productIndex);
    setAdditionalArticleIdInputs((prev) => ({
      ...prev,
      [key]: prev[key] ?? "",
    }));
    setArticleIdDialogIndex(productIndex);
  };

  const handleCloseArticleIdDialog = () => {
    setArticleIdDialogIndex(null);
  };

  const dialogProductValue =
    articleIdDialogIndex !== null ? products[articleIdDialogIndex] : null;
  const dialogAdditionalKey =
    articleIdDialogIndex !== null
      ? getAdditionalInputKey("product", articleIdDialogIndex)
      : null;
  const dialogPendingValue = dialogAdditionalKey
    ? (additionalArticleIdInputs[dialogAdditionalKey] ?? "")
    : "";
  const dialogAdditionalCount =
    dialogProductValue?.additional_article_ids?.length ?? 0;

  const handleApplyArticleIds = () => {
    if (articleIdDialogIndex === null) return;
    const didCommit =
      commitAdditionalArticleIdsForProduct(articleIdDialogIndex);
    if (didCommit) {
      handleCloseArticleIdDialog();
    }
  };

  // Helper to add variations to a parent product
  const addVariationsToParent = (parentIndex: number, count: number) => {
    const parent = products[parentIndex];
    if (!parent) return;

    const currentVariations = parent.variations || [];
    const startIndex = currentVariations.length + 1;

    const newVariations = Array.from({ length: count }, (_, i) => ({
      article_id: "",
      product_name: "",
      product_link: "",
      cad_file_link: "",
      category: parent.category || "",
      subcategory: parent.subcategory || "",
      references: [],
      measurements: undefined,
      parent_article_id: parent.article_id || "",
      variation_index: startIndex + i,
      additional_article_ids: [],
    }));

    const updatedProducts = [...products];
    updatedProducts[parentIndex] = {
      ...parent,
      variations: [...currentVariations, ...newVariations],
    };
    setProducts(updatedProducts);

    // Expand variations section if not already expanded
    if (!expandedVariations.has(parentIndex)) {
      setExpandedVariations(new Set([...expandedVariations, parentIndex]));
    }
  };

  // Helper to remove a variation from a parent
  const _removeVariation = (parentIndex: number, variationIndex: number) => {
    const updatedProducts = [...products];
    const parent = updatedProducts[parentIndex];
    if (!parent?.variations) return;

    parent.variations = parent.variations.filter(
      (_, i) => i !== variationIndex
    );
    // Re-index variations
    parent.variations.forEach((v, i) => {
      v.variation_index = i + 1;
    });
    setProducts(updatedProducts);
  };

  // Helper to update a variation
  const _updateVariation = (
    parentIndex: number,
    variationIndex: number,
    field: keyof ProductForm,
    value: string | number
  ) => {
    setProducts((prev) => {
      const updatedProducts = [...prev];
      const parent = updatedProducts[parentIndex];
      if (!parent?.variations) return prev;

      const variations = [...parent.variations];
      const currentVariation = {
        ...variations[variationIndex],
        [field]: value,
      };

      if (field === "article_id" && typeof value === "string") {
        const normalized = normalizeArticleIdArray(
          value,
          currentVariation.additional_article_ids || []
        );
        currentVariation.additional_article_ids = normalized.filter(
          (id) => id !== value.trim()
        );
      }

      variations[variationIndex] = currentVariation;
      updatedProducts[parentIndex] = {
        ...parent,
        variations,
      };

      return updatedProducts;
    });
  };

  // Toggle expanded state for variations
  const _toggleVariations = (index: number) => {
    const newExpanded = new Set(expandedVariations);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedVariations(newExpanded);
  };

  const handleSubmit = async () => {
    if (!user?.metadata?.client) {
      toast.error("User not authenticated");
      return;
    }

    // Validate required fields
    const validProducts = products.filter(
      (product) =>
        product.article_id.trim() &&
        product.product_name.trim() &&
        product.product_link.trim()
    );

    if (validProducts.length === 0) {
      toast.error("Please add at least one product with required fields");
      return;
    }

    setLoading(true);

    // Use first company if user has multiple
    const clientName = Array.isArray(user.metadata.client)
      ? user.metadata.client[0]
      : user.metadata.client;

    // Show loading toast
    const loadingToast = toast.loading("Adding products...", {
      description: `Processing ${validProducts.length} product${validProducts.length === 1 ? "" : "s"} and grouping automatically`,
    });

    try {
      // Convert products to CSV format for AI grouping
      // CSV header
      const csvHeader = ['Article ID', 'Product Name', 'Product Link', 'CAD/File Link', 'Category', 'Subcategory', 'Active'];
      
      // Helper function to format measurements
      const _formatMeasurements = (product: ProductForm) => {
        if (
          product.measurements?.height &&
          product.measurements?.width &&
          product.measurements?.depth
        ) {
          return `${product.measurements.height},${product.measurements.width},${product.measurements.depth}`;
        }
        return null;
      };

      // Process products: handle parents with variations separately
      // For CSV import, we'll flatten parents and variations into the CSV
      const parentProducts = validProducts.filter((p) => p.is_parent);
      const regularProducts = validProducts.filter(
        (p) => !p.is_parent && !p.parent_article_id
      );

      // Build CSV rows: include regular products and flatten parent/variation structure
      const csvRows: string[][] = [];
      
      // Add regular products to CSV
      regularProducts.forEach((product) => {
        const escapeCsvValue = (value: string | null | undefined) => {
          if (!value) return '';
          const str = String(value).trim();
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        csvRows.push([
          escapeCsvValue(product.article_id),
          escapeCsvValue(product.product_name),
          escapeCsvValue(product.product_link),
          escapeCsvValue(product.cad_file_link),
          escapeCsvValue(product.category),
          escapeCsvValue(product.subcategory),
          'TRUE' // Active
        ]);
      });

      // Add parent products and their variations to CSV (flattened)
      parentProducts.forEach((parentProduct) => {
        const escapeCsvValue = (value: string | null | undefined) => {
          if (!value) return '';
          const str = String(value).trim();
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        // Add parent to CSV
        csvRows.push([
          escapeCsvValue(parentProduct.article_id),
          escapeCsvValue(parentProduct.product_name),
          escapeCsvValue(parentProduct.product_link),
          escapeCsvValue(parentProduct.cad_file_link),
          escapeCsvValue(parentProduct.category),
          escapeCsvValue(parentProduct.subcategory),
          'TRUE' // Active
        ]);

        // Add variations to CSV
        const variations = parentProduct.variations || [];
        variations.forEach((variation) => {
          if (variation.article_id.trim() && variation.product_name.trim() && variation.product_link.trim()) {
            csvRows.push([
              escapeCsvValue(variation.article_id),
              escapeCsvValue(variation.product_name),
              escapeCsvValue(variation.product_link),
              escapeCsvValue(variation.cad_file_link),
              escapeCsvValue(variation.category || parentProduct.category),
              escapeCsvValue(variation.subcategory || parentProduct.subcategory),
              'TRUE' // Active
            ]);
          }
        });
      });

      // Combine header and rows
      const csvText = [csvHeader, ...csvRows]
        .map(row => row.join(','))
        .join('\n');

      console.log('[FRONTEND] Calling /api/csv/import from handleSubmit (spreadsheet)');
      console.log('[FRONTEND] CSV length:', csvText.length, 'Client:', clientName, 'Products:', validProducts.length);
      
      // Call the import API (this triggers AI grouping)
      const response = await fetch('/api/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvText,
          clientName: clientName,
          batch: currentBatch,
          dryRun: false
        })
      });

      console.log('[FRONTEND] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FRONTEND] Error response:', errorText);
        toast.error("Failed to add products. Please try again.", {
          id: loadingToast,
        });
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[FRONTEND] Import result:', data);
      
      const successCount = data.import?.importedCount || 0;
      const groupingInfo = data.grouping;

      // Fetch inserted products from database for reference updates
      let insertedProducts: any[] = [];
      // Collect all valid products including variations for reference matching
      const allValidProducts: ProductForm[] = [
        ...regularProducts,
        ...parentProducts,
        ...parentProducts.flatMap(p => p.variations || [])
      ];
      
      if (successCount > 0 && allValidProducts.some((p) => p.references && p.references.length > 0)) {
        const articleIds = allValidProducts.map(p => p.article_id.trim());
        const { data: fetchedProducts } = await supabase
          .from("onboarding_assets")
          .select("id, article_id")
          .eq("client", clientName)
          .in("article_id", articleIds);
        
        insertedProducts = fetchedProducts || [];
      }

      // Upload references if any products have them
      // Need to match products with their inserted IDs correctly (including variations)
      if (
        insertedProducts &&
        insertedProducts.length > 0 &&
        allValidProducts.some((p) => p.references && p.references.length > 0)
      ) {
        toast.loading("Uploading references...", {
          id: loadingToast,
          description: "Uploading reference files and URLs",
        });

        // Map inserted products by article_id for reference updates
        const productMap = new Map();
        insertedProducts.forEach((p: any) => {
          if (p.article_id) {
            productMap.set(p.article_id, p);
          }
        });

        // Process all products (regular + parents + variations) for references
        for (let i = 0; i < allValidProducts.length; i++) {
          const product = allValidProducts[i];
          const insertedProduct = productMap.get(product.article_id.trim());

          if (product.references && product.references.length > 0 && insertedProduct) {
            const referenceUrls: string[] = [];

            // Upload files and add URLs
            for (const ref of product.references) {
              if (ref.type === "file" && ref.file) {
                try {
                  // Upload file using the same API as AddReferenceDialog (BunnyCDN)
                  const formData = new FormData();
                  formData.append("file", ref.file);
                  formData.append("client_name", clientName);

                  const response = await fetch("/api/assets/upload-file", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                  });

                  if (response.ok) {
                    const data = await response.json();
                    if (data.url) {
                      referenceUrls.push(data.url);
                    }
                  } else {
                    console.error(
                      "Error uploading reference file:",
                      await response.text()
                    );
                  }
                } catch (uploadError) {
                  console.error("Error uploading reference:", uploadError);
                }
              } else if (ref.type === "url") {
                referenceUrls.push(ref.value);
              }
            }

            // Update the asset with reference URLs
            if (referenceUrls.length > 0) {
              await supabase
                .from("onboarding_assets")
                .update({ reference: referenceUrls.join("|||") })
                .eq("id", insertedProduct.id);
            }
          }
        }
      }

      // Send notification to admin users about new product submission
      try {
        await notificationService.sendProductSubmissionNotification({
          client: clientName,
          batch: currentBatch,
          productCount: successCount,
          productNames: allValidProducts.map((p) => p.product_name),
          submittedAt: new Date().toISOString(),
        });
      } catch (notificationError) {
        console.error(
          "Failed to send product submission notification:",
          notificationError
        );
        // Don't fail the product submission if notification fails
      }

      // Automatically collect images in the background (fire and forget)
      collectImages().catch((error) => {
        console.warn("Background image collection failed:", error);
      });

      // Success message with grouping info
      let description = `Your products have been added to batch ${currentBatch} and are ready for review.`;
      if (groupingInfo?.status === 'processing') {
        description += ' Products are being grouped automatically in the background.';
      } else if (groupingInfo?.totalGroups) {
        description += ` Products grouped into ${groupingInfo.totalGroups} groups for easier allocation.`;
      }

      toast.success(
        `🎉 Successfully added ${successCount} product${successCount === 1 ? "" : "s"} to batch ${currentBatch}!`,
        {
          id: loadingToast,
          description: description,
          duration: 5000,
        }
      );

      // Reset form and clear cache
      setProducts([
        {
          article_id: "",
          product_name: "",
          product_link: "",
          cad_file_link: "",
          category: "",
          subcategory: "",
          references: [],
          measurements: undefined,
        },
      ]);
      setExpandedVariations(new Set());
      clearStorage(); // Clear localStorage after successful submit

      // Increment batch number for next use
      setCurrentBatch((prev) => prev + 1);
    } catch (error) {
      console.error('[FRONTEND] Error adding products:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a link to the actual CSV template file
    const a = document.createElement("a");
    a.href = "/csv-template.csv";
    a.download = "product-template.csv";
    a.click();
  };

  const getValidProducts = () => {
    return products.filter(
      (product) =>
        product.article_id.trim() &&
        product.product_name.trim() &&
        product.product_link.trim()
    );
  };

  const handleFile = (file: File) => {
    setCsvFile(file);
    setCsvLoading(true);
    setCsvErrors([]);
    setCsvWarnings([]);
    setEditingRow(null);
    setEditedCsvData(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Improved CSV parsing with better handling of edge cases
      const rows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((row) => {
          // Split by comma but handle quoted fields
          const result = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        });

      // Validate rows for errors and warnings
      const errors: { row: number; message: string }[] = [];
      const warnings: {
        row: number;
        message: string;
        type: "duplicate_article_id" | "missing_fields";
      }[] = [];

      // Check for missing required fields
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || !row[1] || !row[2]) {
          errors.push({
            row: i + 1,
            message:
              "Missing required fields (Article ID, Product Name, Product Link)",
          });
        }
      }

      // Check for duplicate article IDs
      const articleIds = new Map<string, number[]>();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const articleId = row[0]?.trim();
        if (articleId) {
          if (!articleIds.has(articleId)) {
            articleIds.set(articleId, []);
          }
          articleIds.get(articleId)!.push(i + 1);
        }
      }

      // Add warnings for duplicate article IDs
      for (const [articleId, rowNumbers] of articleIds.entries()) {
        if (rowNumbers.length > 1) {
          for (const rowNum of rowNumbers) {
            warnings.push({
              row: rowNum,
              message: `Duplicate Article ID: "${articleId}" appears in ${rowNumbers.length} rows`,
              type: "duplicate_article_id",
            });
          }
        }
      }

      setCsvPreview(rows);
      setEditedCsvData([...rows]); // Initialize edited data
      setCsvErrors(errors);
      setCsvWarnings(warnings);
      setCsvLoading(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const startEditing = (rowIndex: number) => {
    setEditingRow(rowIndex);
  };

  const saveEdit = (rowIndex: number, columnIndex: number, value: string) => {
    if (!editedCsvData) return;

    const newData = [...editedCsvData];
    newData[rowIndex][columnIndex] = value;
    setEditedCsvData(newData);

    // Update csvPreview to reflect changes
    setCsvPreview(newData);

    // Re-validate after edit
    validateCsvData(newData);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    // Restore original data
    if (csvPreview) {
      setEditedCsvData([...csvPreview]);
    }
  };

  const validateCsvData = (data: string[][]) => {
    const errors: { row: number; message: string }[] = [];
    const warnings: {
      row: number;
      message: string;
      type: "duplicate_article_id" | "missing_fields";
    }[] = [];

    // Check for missing required fields
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || !row[1] || !row[2]) {
        errors.push({
          row: i + 1,
          message:
            "Missing required fields (Article ID, Product Name, Product Link)",
        });
      }
    }

    // Check for duplicate article IDs
    const articleIds = new Map<string, number[]>();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const articleId = row[0]?.trim();
      if (articleId) {
        if (!articleIds.has(articleId)) {
          articleIds.set(articleId, []);
        }
        articleIds.get(articleId)!.push(i + 1);
      }
    }

    // Add warnings for duplicate article IDs
    for (const [articleId, rowNumbers] of articleIds.entries()) {
      if (rowNumbers.length > 1) {
        for (const rowNum of rowNumbers) {
          warnings.push({
            row: rowNum,
            message: `Duplicate Article ID: "${articleId}" appears in ${rowNumbers.length} rows`,
            type: "duplicate_article_id",
          });
        }
      }
    }

    setCsvErrors(errors);
    setCsvWarnings(warnings);
  };

  const handleCsvUpload = async () => {
    if (!csvPreview || !user?.metadata?.client) return;

    setLoading(true);
    // Use first company if user has multiple
    const client = Array.isArray(user.metadata.client)
      ? user.metadata.client[0]
      : user.metadata.client;
    
    // Use edited data if available, otherwise use original preview
    const dataToUpload = editedCsvData || csvPreview;
    
    // Convert spreadsheet data to CSV text format
    const csvText = dataToUpload.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    // Show initial loading toast
    const loadingToast = toast.loading("Importing products...", {
      description: "Processing CSV and grouping products automatically",
    });

    try {
      console.log('[FRONTEND] Calling /api/csv/import from add-products page');
      console.log('[FRONTEND] CSV length:', csvText.length, 'Client:', client);
      
      const response = await fetch('/api/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvText,
          clientName: client,
          batch: currentBatch,
          dryRun: false
        })
      });

      console.log('[FRONTEND] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FRONTEND] Error response:', errorText);
        toast.error("Failed to import products. Please try again.", {
          id: loadingToast,
        });
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[FRONTEND] Import result:', data);
      
      const successCount = data.import?.importedCount || 0;
      const groupingInfo = data.grouping;

      // Clear state
      setLoading(false);
      setCsvFile(null);
      setCsvPreview(null);
      setCsvErrors([]);
      setCsvWarnings([]);
      setEditingRow(null);
      setEditedCsvData(null);
      setShowPreviewDialog(false);
      resetFileInput();

      if (successCount > 0) {
        // Send notification to admin users about new product submission via CSV
        try {
          const rows = dataToUpload.slice(1); // skip header
          const productNames = rows
            .filter((row) => row[1]?.trim()) // filter rows with product names
            .map((row) => row[1].trim())
            .slice(0, successCount);

          await notificationService.sendProductSubmissionNotification({
            client: client,
            batch: currentBatch,
            productCount: successCount,
            productNames: productNames,
            submittedAt: new Date().toISOString(),
          });
        } catch (notificationError) {
          console.error(
            "Failed to send CSV product submission notification:",
            notificationError
          );
        }

        // Automatically collect images in the background (fire and forget)
        collectImages().catch((error) => {
          console.warn("Background image collection failed:", error);
        });

        let description = `Your products have been added to batch ${currentBatch} and are ready for review.`;
        if (groupingInfo?.status === 'processing') {
          description += ' Products are being grouped automatically in the background.';
        } else if (groupingInfo?.totalGroups) {
          description += ` Products grouped into ${groupingInfo.totalGroups} groups for easier allocation.`;
        }

        toast.success(
          `🎉 Successfully imported ${successCount} product${successCount === 1 ? "" : "s"}!`,
          {
            id: loadingToast,
            description: description,
            duration: 5000,
          }
        );
        // Increment batch number for next use
        setCurrentBatch((prev) => prev + 1);
      } else {
        toast.error("No products were imported. Please check your data.", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error('[FRONTEND] Error importing CSV:', error);
      toast.error("Failed to import products. Please try again.", {
        id: loadingToast,
      });
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const AddProductsSkeleton = () => (
    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20 flex flex-col p-6">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div>
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-6 w-20 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Main Form Skeleton */}
        <div className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j}>
                        <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
                        <div className="h-10 w-full bg-muted rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                  </div>
                  <div>
                    <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="w-80 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-6 w-24 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-primary rounded-lg p-6 text-center">
                <div className="h-8 w-8 bg-muted rounded animate-pulse mx-auto mb-2" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse mx-auto mb-3" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse mx-auto" />
              </div>
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
              <div className="pt-4 border-t border-slate-200 dark:border-primary">
                <div className="h-3 w-48 bg-muted rounded animate-pulse mb-3" />
                <div className="h-8 w-full bg-muted rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div>
                <div className="h-4 w-28 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-20 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  if (pageLoading) {
    return <AddProductsSkeleton />;
  }

  return (
    <div className="container mx-auto ">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/client-review")}
            className="hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <Badge variant="outline" className="text-sm">
            Batch #{currentBatch}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Main Form */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-15rem)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Details
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Fill in the required fields (marked with *). Optional fields can be left empty.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="min-w-[200px]">Article ID *</TableHead>
                      <TableHead className="min-w-[200px]">Product Name *</TableHead>
                      <TableHead className="min-w-[200px]">Product Link *</TableHead>
                      <TableHead className="min-w-[150px]">CAD/File Link</TableHead>
                      <TableHead className="min-w-[120px]">Category</TableHead>
                      <TableHead className="min-w-[120px]">Subcategory</TableHead>
                      <TableHead className="min-w-[150px]">References</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={product.article_id}
                              onChange={(e) => {
                                const updated = [...products];
                                updated[index].article_id = e.target.value;
                                setProducts(updated);
                              }}
                              placeholder="Article ID"
                              className="h-8 flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0"
                              onClick={() => {
                                const key = getAdditionalInputKey("product", index);
                                setAdditionalArticleIdInputs((prev) => ({
                                  ...prev,
                                  [key]: prev[key] ?? "",
                                }));
                                setArticleIdDialogIndex(index);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={product.product_name}
                            onChange={(e) => {
                              const updated = [...products];
                              updated[index].product_name = e.target.value;
                              setProducts(updated);
                            }}
                            placeholder="Name"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={product.product_link}
                            onChange={(e) => {
                              const updated = [...products];
                              updated[index].product_link = e.target.value;
                              setProducts(updated);
                            }}
                            placeholder="Link"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={product.cad_file_link}
                            onChange={(e) => {
                              const updated = [...products];
                              updated[index].cad_file_link = e.target.value;
                              setProducts(updated);
                            }}
                            placeholder="CAD Link"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={product.category}
                            onChange={(e) => {
                              const updated = [...products];
                              updated[index].category = e.target.value;
                              setProducts(updated);
                            }}
                            placeholder="Category"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={product.subcategory}
                            onChange={(e) => {
                              const updated = [...products];
                              updated[index].subcategory = e.target.value;
                              setProducts(updated);
                            }}
                            placeholder="Subcat"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => {
                                setEditingReferencesIndex(index);
                                setShowReferencesDialog(true);
                              }}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Add
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                const refs = product.references || [];
                                if (refs.length > 0) {
                                  const text = refs.map(r => r.value).join(', ');
                                  navigator.clipboard.writeText(text);
                                  toast.success('References copied to clipboard');
                                }
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {products.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setProducts(products.filter((_, i) => i !== index));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex gap-3 items-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setProducts([
                      ...products,
                      {
                        article_id: "",
                        product_name: "",
                        product_link: "",
                        cad_file_link: "",
                        category: "",
                        subcategory: "",
                        references: [],
                        measurements: undefined,
                        additional_article_ids: [],
                      },
                    ]);
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Product
                </Button>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="0"
                    value={addMultipleProducts}
                    onChange={(e) => setAddMultipleProducts(e.target.value)}
                    className="w-20 h-9"
                  />
                  <Button
                    variant="outline"
                    onClick={addMultipleLinesFunction}
                    className="flex items-center gap-2"
                  >
                    Add {addMultipleProducts || "0"} Rows
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="mt-6">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={loading || getValidProducts().length === 0}
              className="w-full cursor-pointer h-11"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding Products...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Add Products to Batch {currentBatch}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* CSV Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                CSV Upload
                {csvWarnings.length > 0 && (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                Upload a CSV to add multiple products at once.
              </div>
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-slate-300 dark:border-primary hover:border-slate-400"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {csvLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Processing CSV...
                    </p>
                  </div>
                ) : csvFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium text-primary">
                      {csvFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {csvPreview
                        ? `${csvPreview.length - 1} products ready to upload`
                        : "Processing..."}
                    </p>
                    {csvWarnings.length > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        {" "}
                        {
                          csvWarnings.filter(
                            (w) => w.type === "duplicate_article_id"
                          ).length
                        }{" "}
                        duplicate Article IDs detected
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview(null);
                        setCsvErrors([]);
                        setCsvWarnings([]);
                        setEditingRow(null);
                        setEditedCsvData(null);
                        resetFileInput();
                      }}
                      className="mt-2 cursor-pointer"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-primary mb-1">
                      Drop CSV file here
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      or click to browse
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer"
                    >
                      Choose File
                    </Button>
                  </div>
                )}
              </div>

              {/* Preview and Upload Buttons */}
              {csvPreview && csvPreview.length > 1 && (
                <div className="space-y-3">
                  <Button
                    onClick={() => setShowPreviewDialog(true)}
                    variant="outline"
                    className="w-full cursor-pointer"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview {csvPreview.length - 1} Products
                  </Button>

                  <Button
                    onClick={() => setShowCsvUploadConfirmDialog(true)}
                    disabled={loading}
                    className="w-full cursor-pointer"
                    title={
                      csvWarnings.length > 0
                        ? "Warning: Some products have duplicate Article IDs"
                        : ""
                    }
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload {csvPreview.length - 1} Products
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Template Download */}
              <div className="pt-4 border-t border-slate-200 dark:border-primary">
                <p className="text-sm text-muted-foreground mb-3">
                  Download the CSV template to format your data
                </p>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  size="sm"
                  className="w-full cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Batch Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Batch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Batch
                </p>
                <p className="text-2xl font-bold text-primary">
                  {currentBatch}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Products in Form
                </p>
                <p className="text-2xl font-bold text-primary">
                  {products.length}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Products will be automatically assigned to batch {currentBatch}{" "}
                when added
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSV Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="min-w-[70vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSV Preview ({csvPreview?.length ? csvPreview.length - 1 : 0}{" "}
              products)
              {editedCsvData && (
                <Badge variant="outline" className="text-xs">
                  Editable
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {csvPreview?.length
                ? `${csvPreview.length - 1} products found. Please review before confirming.`
                : ""}
            </span>
            <div className="flex items-center gap-2">
              {editedCsvData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditedCsvData([...csvPreview!]);
                    setEditingRow(null);
                    validateCsvData(csvPreview!);
                  }}
                  className="cursor-pointer"
                  title="Reset all changes to original values"
                >
                  Reset Changes
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCsvFile(null);
                  setCsvPreview(null);
                  setCsvErrors([]);
                  setCsvWarnings([]);
                  setEditingRow(null);
                  setEditedCsvData(null);
                  setShowPreviewDialog(false);
                  resetFileInput();
                }}
                className="cursor-pointer"
              >
                <X className="h-4 w-4 mr-1" />
                Remove file & re-upload
              </Button>
            </div>
          </div>
          {csvErrors.length > 0 && (
            <Alert variant="destructive" className="mb-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2">
                <span>Some rows are missing required fields.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!csvPreview) return;
                    const errorCsv = [
                      csvPreview[0],
                      ...csvErrors.map((e) => [e.row, e.message]),
                    ]
                      .map((r) => r.join(","))
                      .join("\n");
                    const blob = new Blob([errorCsv], { type: "text/csv" });
                    saveAs.saveAs(blob, "csv-errors.csv");
                  }}
                >
                  Download error report
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {csvWarnings.length > 0 && (
            <Alert
              variant="default"
              className="mb-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center gap-2">
                <span>
                  Some rows have duplicate Article IDs. Please review before
                  proceeding.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!csvPreview) return;
                    const warningCsv = [
                      csvPreview[0],
                      ...csvWarnings.map((w) => [w.row, w.message]),
                    ]
                      .map((r) => r.join(","))
                      .join("\n");
                    const blob = new Blob([warningCsv], { type: "text/csv" });
                    saveAs.saveAs(blob, "csv-warnings.csv");
                  }}
                >
                  Download warning report
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Article ID</TableHead>
                    <TableHead className="text-left">Product Name</TableHead>
                    <TableHead className="text-left">Product Link</TableHead>
                    <TableHead className="text-left">CAD/File Link</TableHead>
                    <TableHead className="text-left">Category</TableHead>
                    <TableHead className="text-left">Subcategory</TableHead>
                    <TableHead className="text-left">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvPreview?.slice(1).map((row, index) => {
                    const [
                      articleId,
                      productName,
                      productLink,
                      cadFileLink,
                      category,
                      subcategory,
                    ] = row;
                    const hasError = csvErrors.some((e) => e.row === index + 2);
                    const hasWarning = csvWarnings.some(
                      (w) => w.row === index + 2
                    );
                    const rowClassName = hasError
                      ? "bg-red-50"
                      : hasWarning
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "";
                    const isEditing = editingRow === index;

                    return (
                      <TableRow key={index} className={rowClassName}>
                        <TableCell className="font-medium text-left">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[0] ||
                                articleId ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 0, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Article ID"
                            />
                          ) : (
                            articleId || "-"
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[1] ||
                                productName ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 1, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Product Name"
                            />
                          ) : (
                            productName || "-"
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[2] ||
                                productLink ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 2, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Product Link"
                            />
                          ) : (
                            <div className="flex items-center">
                              {productLink ? (
                                <a
                                  href={productLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-info hover:text-info/80 underline truncate block max-w-48"
                                  title={productLink}
                                >
                                  {productLink.length > 50
                                    ? `${productLink.substring(0, 50)}...`
                                    : productLink}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[3] ||
                                cadFileLink ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 3, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="CAD/File Link"
                            />
                          ) : (
                            <div className="flex items-center">
                              {cadFileLink ? (
                                <a
                                  href={cadFileLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-info hover:text-info/80 underline truncate block max-w-48"
                                  title={cadFileLink}
                                >
                                  {cadFileLink.length > 50
                                    ? `${cadFileLink.substring(0, 50)}...`
                                    : cadFileLink}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[4] ||
                                category ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 4, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Category"
                            />
                          ) : (
                            <span className="font-medium">
                              {category || "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[5] ||
                                subcategory ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 5, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Subcategory"
                            />
                          ) : (
                            <span className="font-medium">
                              {subcategory || "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingRow(null)}
                                  className="h-6 px-2 text-xs"
                                >
                                  Done
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEdit}
                                  className="h-6 px-2 text-xs text-muted-foreground"
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditing(index)}
                                className="h-6 px-2 text-xs"
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4 items-center flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setShowCsvUploadConfirmDialog(true)}
              disabled={loading || csvErrors.length > 0}
              className="cursor-pointer"
              title={
                csvWarnings.length > 0
                  ? "Warning: Some products have duplicate Article IDs"
                  : ""
              }
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Add to Batch {currentBatch}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Products Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="min-w-[70vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Review Products Before Adding to Batch {currentBatch}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article ID</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Product Link</TableHead>
                    <TableHead>CAD/File Link</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subcategory</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const allProductsToShow: (ProductForm & {
                      isVariation?: boolean;
                      parentIndex?: number;
                    })[] = [];

                    // Add regular products and parents
                    getValidProducts().forEach((product) => {
                      const currentProductIndex = allProductsToShow.length;
                      allProductsToShow.push(product);

                      // Add variations if this is a parent
                      if (product.is_parent && product.variations) {
                        const validVariations = product.variations.filter(
                          (v) =>
                            v.article_id.trim() &&
                            v.product_name.trim() &&
                            v.product_link.trim()
                        );
                        validVariations.forEach((variation) => {
                          allProductsToShow.push({
                            ...variation,
                            isVariation: true,
                            parentIndex: currentProductIndex,
                          });
                        });
                      }
                    });

                    return allProductsToShow.map((product, index) => {
                      return (
                        <TableRow
                          key={index}
                          className={product.isVariation ? "bg-muted/30" : ""}
                        >
                          <TableCell className="font-medium">
                            {product.isVariation && (
                              <Badge variant="outline" className="text-xs mr-1">
                                V{product.variation_index}
                              </Badge>
                            )}
                            {product.article_id || "-"}
                          </TableCell>
                          <TableCell>
                            <div
                              className="truncate cursor-help"
                              title={product.product_name || "-"}
                            >
                              {product.product_name &&
                              product.product_name.length > 35
                                ? product.product_name.substring(0, 35) + "..."
                                : product.product_name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {product.product_link ? (
                              <a
                                href={product.product_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-info hover:text-info/80 underline truncate block max-w-48"
                                title={product.product_link}
                              >
                                {product.product_link.length > 50
                                  ? `${product.product_link.substring(0, 50)}...`
                                  : product.product_link}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {product.cad_file_link ? (
                              <a
                                href={product.cad_file_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-info hover:text-info/80 underline truncate block max-w-48"
                                title={product.cad_file_link}
                              >
                                {product.cad_file_link.length > 50
                                  ? `${product.cad_file_link.substring(0, 50)}...`
                                  : product.cad_file_link}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {product.category || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {product.subcategory || "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border items-center flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false);
                handleSubmit();
              }}
              disabled={loading}
              className="cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Add to Batch {currentBatch}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Confirmation Dialog */}
      <Dialog
        open={showCsvUploadConfirmDialog}
        onOpenChange={setShowCsvUploadConfirmDialog}
      >
        <DialogContent className="min-w-[70vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Confirm CSV Upload
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Are you sure you want to upload these products?
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This will add {csvPreview?.length ? csvPreview.length - 1 : 0}{" "}
                  products to batch {currentBatch}. This action cannot be
                  undone.
                </p>
              </div>

              {csvWarnings.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">
                      Warnings Detected
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {
                      csvWarnings.filter(
                        (w) => w.type === "duplicate_article_id"
                      ).length
                    }{" "}
                    products have duplicate Article IDs. Please review before
                    proceeding.
                  </p>
                </div>
              )}

              <div className="max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Article ID</TableHead>
                      <TableHead className="text-left">Product Name</TableHead>
                      <TableHead className="text-left">Product Link</TableHead>
                      <TableHead className="text-left">CAD/File Link</TableHead>
                      <TableHead className="text-left">Category</TableHead>
                      <TableHead className="text-left">Subcategory</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview?.slice(1).map((row, index) => {
                      const [
                        articleId,
                        productName,
                        productLink,
                        cadFileLink,
                        category,
                        subcategory,
                      ] = row;
                      const hasError = csvErrors.some(
                        (e) => e.row === index + 2
                      );
                      const hasWarning = csvWarnings.some(
                        (w) => w.row === index + 2
                      );
                      const rowClassName = hasError
                        ? "bg-red-50"
                        : hasWarning
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : "";

                      return (
                        <TableRow key={index} className={rowClassName}>
                          <TableCell className="font-medium text-left">
                            {articleId || "-"}
                          </TableCell>
                          <TableCell className="text-left">
                            {productName || "-"}
                          </TableCell>
                          <TableCell className="text-left">
                            {productLink ? (
                              <a
                                href={productLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-info hover:text-info/80 underline truncate block max-w-48"
                                title={productLink}
                              >
                                {productLink.length > 50
                                  ? `${productLink.substring(0, 50)}...`
                                  : productLink}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-left">
                            {cadFileLink ? (
                              <a
                                href={cadFileLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-info hover:text-info/80 underline truncate block max-w-48"
                                title={cadFileLink}
                              >
                                {cadFileLink.length > 50
                                  ? `${cadFileLink.substring(0, 50)}...`
                                  : cadFileLink}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-left">
                            <span className="font-medium">
                              {category || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-left">
                            <span className="font-medium">
                              {subcategory || "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4 items-center flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowCsvUploadConfirmDialog(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowCsvUploadConfirmDialog(false);
                handleCsvUpload();
              }}
              disabled={loading || csvErrors.length > 0}
              className="cursor-pointer"
              title={
                csvWarnings.length > 0
                  ? "Warning: Some products have duplicate Article IDs"
                  : ""
              }
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Confirm Upload{" "}
                  {csvPreview?.length ? csvPreview.length - 1 : 0} Products
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* References Dialog */}
      <Dialog
        open={showReferencesDialog}
        onOpenChange={(open) => {
          setShowReferencesDialog(open);
          if (!open) {
            setEditingReferencesIndex(null);
            setEditingVariationRef(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Add References & Measurements
              {editingReferencesIndex !== null &&
                ` - ${products[editingReferencesIndex]?.product_name || `Product ${editingReferencesIndex + 1}`}`}
              {editingVariationRef !== null &&
                ` - Variation ${editingVariationRef.variationIndex + 1}: ${products[editingVariationRef.parentIndex]?.variations?.[editingVariationRef.variationIndex]?.product_name || "Variation"}`}
            </DialogTitle>
          </DialogHeader>

          {(editingReferencesIndex !== null ||
            editingVariationRef !== null) && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Add reference URLs, files, and product measurements that will be
                saved when you submit this product.
              </div>

              {/* Helper to get current product or variation being edited */}
              {(() => {
                const getCurrentProduct = () => {
                  if (editingVariationRef !== null) {
                    return products[editingVariationRef.parentIndex]
                      ?.variations?.[editingVariationRef.variationIndex];
                  }
                  return editingReferencesIndex !== null
                    ? products[editingReferencesIndex]
                    : null;
                };

                const updateCurrentReferences = (
                  updater: (refs: any[]) => any[]
                ) => {
                  const updated = [...products];
                  if (editingVariationRef !== null) {
                    const parentIndex = editingVariationRef.parentIndex;
                    const variationIndex = editingVariationRef.variationIndex;
                    const parent = { ...updated[parentIndex] };
                    if (parent.variations) {
                      // Deep copy variations array
                      parent.variations = [...parent.variations];
                      // Deep copy the specific variation
                      const variation = {
                        ...parent.variations[variationIndex],
                      };
                      variation.references = updater(
                        variation.references || []
                      );
                      parent.variations[variationIndex] = variation;
                      updated[parentIndex] = parent;
                    }
                    setProducts(updated);
                  } else if (editingReferencesIndex !== null) {
                    updated[editingReferencesIndex].references = updater(
                      updated[editingReferencesIndex].references || []
                    );
                    setProducts(updated);
                  }
                };

                const updateCurrentMeasurements = (
                  field: "height" | "width" | "depth",
                  value: string
                ) => {
                  const updated = [...products];
                  if (editingVariationRef !== null) {
                    const parentIndex = editingVariationRef.parentIndex;
                    const variationIndex = editingVariationRef.variationIndex;
                    const parent = { ...updated[parentIndex] };
                    if (parent.variations) {
                      // Deep copy variations array
                      parent.variations = [...parent.variations];
                      // Deep copy the specific variation
                      const variation = {
                        ...parent.variations[variationIndex],
                      };
                      if (!variation.measurements) {
                        variation.measurements = {
                          height: "",
                          width: "",
                          depth: "",
                        };
                      }
                      variation.measurements = {
                        ...variation.measurements,
                        [field]: value,
                      };
                      parent.variations[variationIndex] = variation;
                      updated[parentIndex] = parent;
                    }
                    setProducts(updated);
                  } else if (editingReferencesIndex !== null) {
                    if (!updated[editingReferencesIndex].measurements) {
                      updated[editingReferencesIndex].measurements = {
                        height: "",
                        width: "",
                        depth: "",
                      };
                    }
                    updated[editingReferencesIndex].measurements![field] =
                      value;
                    setProducts(updated);
                  }
                };

                const currentProduct = getCurrentProduct();
                const currentReferences = currentProduct?.references || [];
                const currentMeasurements = currentProduct?.measurements;

                return (
                  <>
                    {/* Recent References */}
                    {recentReferences.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Recent References (Click to add)
                        </Label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border rounded-lg p-2">
                          {recentReferences.map((ref, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                const exists = currentReferences.some(
                                  (r) => r.value === ref.value
                                );
                                if (!exists) {
                                  updateCurrentReferences((refs) => [
                                    ...refs,
                                    ref,
                                  ]);
                                  toast.success("Reference added");
                                } else {
                                  toast.info("Reference already added");
                                }
                              }}
                              title={ref.value}
                            >
                              {ref.value}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Current References */}
                    {currentReferences.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Current References ({currentReferences.length})
                        </Label>
                        <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                          {currentReferences.map((ref, refIndex) => (
                            <div
                              key={refIndex}
                              className="flex items-center justify-between gap-3 p-2 bg-muted rounded"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {isImageReference(ref) ? (
                                  <Image
                                    width={48}
                                    height={48}
                                    src={getImagePreviewUrl(ref) || ""}
                                    alt="Preview"
                                    className="w-12 h-12 object-cover rounded border flex-shrink-0"
                                  />
                                ) : ref.type === "url" ? (
                                  <LinkIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                                )}
                                <span
                                  className="text-sm truncate"
                                  title={ref.value}
                                >
                                  {ref.value}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
                                onClick={() => {
                                  updateCurrentReferences((refs) =>
                                    refs.filter((_, i) => i !== refIndex)
                                  );
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-error" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add URL */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Add Reference URL
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="ref-url-input"
                          placeholder="https://example.com/reference-image.jpg"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const input = e.currentTarget;
                              const url = input.value.trim();
                              if (url) {
                                const newRef = {
                                  type: "url" as const,
                                  value: url,
                                };
                                updateCurrentReferences((refs) => [
                                  ...refs,
                                  newRef,
                                ]);
                                addToRecent(newRef);
                                input.value = "";
                              }
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            const input = document.getElementById(
                              "ref-url-input"
                            ) as HTMLInputElement;
                            const url = input?.value.trim();
                            if (url) {
                              const newRef = {
                                type: "url" as const,
                                value: url,
                              };
                              updateCurrentReferences((refs) => [
                                ...refs,
                                newRef,
                              ]);
                              addToRecent(newRef);
                              input.value = "";
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add URL
                        </Button>
                      </div>
                    </div>

                    {/* Add File */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Upload Reference File
                      </Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const newRef = {
                              type: "file" as const,
                              value: file.name,
                              file: file,
                            };
                            updateCurrentReferences((refs) => [
                              ...refs,
                              newRef,
                            ]);
                            addToRecent(newRef);
                            e.target.value = "";
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Supported: Images (JPG, PNG, etc.) and PDF files
                      </p>
                    </div>

                    {/* Product Measurements */}
                    <div className="space-y-3 p-4 bg-muted/30 dark:bg-muted/10 border border-border dark:border-border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">
                          Product Measurements (Optional)
                        </Label>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Height (mm)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={currentMeasurements?.height || ""}
                            onChange={(e) =>
                              updateCurrentMeasurements(
                                "height",
                                e.target.value
                              )
                            }
                            min="0"
                            step="0.1"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Width (mm)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={currentMeasurements?.width || ""}
                            onChange={(e) =>
                              updateCurrentMeasurements("width", e.target.value)
                            }
                            min="0"
                            step="0.1"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Depth (mm)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={currentMeasurements?.depth || ""}
                            onChange={(e) =>
                              updateCurrentMeasurements("depth", e.target.value)
                            }
                            min="0"
                            step="0.1"
                            className="h-9"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 Enter all dimensions in millimeters (mm)
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReferencesDialog(false);
                          setEditingReferencesIndex(null);
                          setEditingVariationRef(null);
                        }}
                      >
                        Done
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Additional Article IDs Dialog */}
      <Dialog
        open={articleIdDialogIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseArticleIdDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base">Add article IDs</DialogTitle>
            {dialogProductValue?.article_id && (
              <p className="text-sm text-muted-foreground">
                Primary ID: {dialogProductValue.article_id}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Additional IDs
              </Label>
              <Textarea
                value={dialogPendingValue}
                onChange={(e) => {
                  if (!dialogAdditionalKey) return;
                  handleAdditionalArticleIdInputChange(
                    dialogAdditionalKey,
                    e.target.value
                  );
                }}
                rows={4}
                placeholder="ART002, ART003"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleApplyArticleIds();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Separate IDs with commas, spaces, or new lines. Press Ctrl/Cmd +
                Enter to apply.
              </p>
            </div>

            {dialogProductValue?.additional_article_ids &&
              dialogProductValue.additional_article_ids.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Currently linked
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {dialogProductValue.additional_article_ids.map((id) => (
                      <Badge
                        key={`${dialogProductValue.article_id}-${id}`}
                        variant="secondary"
                        className="text-[11px] font-medium"
                      >
                        {id}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {dialogAdditionalCount > 0
                ? `${1 + dialogAdditionalCount} total IDs`
                : "Only primary ID linked"}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {dialogAdditionalCount > 0 && articleIdDialogIndex !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    clearAdditionalArticleIdsForProduct(articleIdDialogIndex)
                  }
                >
                  Clear extras
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseArticleIdDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyArticleIds}
                disabled={!dialogPendingValue.trim()}
              >
                Apply IDs
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View References Dialog */}
      {(viewingReferencesIndex !== null || viewingVariationRef !== null) && (
        <ViewReferencesDialog
          open={showViewReferencesDialog}
          onOpenChange={(open) => {
            setShowViewReferencesDialog(open);
            if (!open) {
              setViewingReferencesIndex(null);
              setViewingVariationRef(null);
            }
          }}
          asset={
            viewingVariationRef !== null
              ? {
                  product_name:
                    products[viewingVariationRef.parentIndex]?.variations?.[
                      viewingVariationRef.variationIndex
                    ]?.product_name ||
                    `Variation ${viewingVariationRef.variationIndex + 1}`,
                  article_id:
                    products[viewingVariationRef.parentIndex]?.variations?.[
                      viewingVariationRef.variationIndex
                    ]?.article_id || "",
                  measurements: (() => {
                    const variation =
                      products[viewingVariationRef.parentIndex]?.variations?.[
                        viewingVariationRef.variationIndex
                      ];
                    return variation?.measurements
                      ? `${variation.measurements.height},${variation.measurements.width},${variation.measurements.depth}`
                      : null;
                  })(),
                }
              : viewingReferencesIndex !== null
                ? {
                    product_name:
                      products[viewingReferencesIndex]?.product_name ||
                      `Product ${viewingReferencesIndex + 1}`,
                    article_id:
                      products[viewingReferencesIndex]?.article_id || "",
                    measurements: products[viewingReferencesIndex]?.measurements
                      ? `${products[viewingReferencesIndex].measurements.height},${products[viewingReferencesIndex].measurements.width},${products[viewingReferencesIndex].measurements.depth}`
                      : null,
                  }
                : {
                    product_name: "",
                    article_id: "",
                    measurements: null,
                  }
          }
          temporaryReferences={
            viewingVariationRef !== null
              ? products[viewingVariationRef.parentIndex]?.variations?.[
                  viewingVariationRef.variationIndex
                ]?.references || []
              : viewingReferencesIndex !== null
                ? products[viewingReferencesIndex]?.references || []
                : []
          }
        />
      )}

      {/* Add Variations Dialog */}
      <Dialog
        open={showAddVariationsDialog}
        onOpenChange={(open) => {
          setShowAddVariationsDialog(open);
          if (!open) {
            setAddVariationsParentIndex(null);
            setVariationsCount("1");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Variations
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="variations-count">
                How many variations would you like to add?
              </Label>
              <Input
                id="variations-count"
                type="number"
                min="1"
                value={variationsCount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || parseInt(value) > 0) {
                    setVariationsCount(value);
                  }
                }}
                placeholder="Enter number"
                className="h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const count = parseInt(variationsCount);
                    if (count > 0 && addVariationsParentIndex !== null) {
                      addVariationsToParent(addVariationsParentIndex, count);
                      setShowAddVariationsDialog(false);
                      setAddVariationsParentIndex(null);
                      setVariationsCount("1");
                    }
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the number of variations you want to add to this parent
                product.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddVariationsDialog(false);
                  setAddVariationsParentIndex(null);
                  setVariationsCount("1");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const count = parseInt(variationsCount);
                  if (count > 0 && addVariationsParentIndex !== null) {
                    addVariationsToParent(addVariationsParentIndex, count);
                    setShowAddVariationsDialog(false);
                    setAddVariationsParentIndex(null);
                    setVariationsCount("1");
                    toast.success(
                      `Added ${count} variation${count === 1 ? "" : "s"}`
                    );
                  } else {
                    toast.error("Please enter a valid number greater than 0");
                  }
                }}
                disabled={!variationsCount || parseInt(variationsCount) <= 0}
              >
                Variations
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
