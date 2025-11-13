"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";
import { Input, Textarea } from "@/components/ui/inputs";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import { Combobox } from "@/components/ui/inputs/combobox";
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
  ChevronDown,
  ChevronRight,
  Copy,
  Layers,
} from "lucide-react";

import * as saveAs from "file-saver";
import { cn } from "@/lib/utils";

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

interface ClientOption {
  name: string;
  variation_contracted?: boolean | null;
}

const STORAGE_KEY = "admin-upload-cache";

const ILLEGAL_FILE_CHAR_REGEX = /[<>:"/\\|?*]/g;

const findIllegalFileCharacters = (value: string): string[] => {
  if (!value) return [];
  const matches = value.match(ILLEGAL_FILE_CHAR_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches));
};

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

const buildArticleIdPayload = (product: ProductForm) => {
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
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState("");
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
  const roleGuardRef = useRef(false);
  const previousClientRef = useRef<string>("");
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
  const [isVariationContracted, setIsVariationContracted] = useState(false);
  const isAdmin = user?.metadata?.role === "admin";
  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: client.name,
        label: client.name,
      })),
    [clients]
  );
  const clientPlaceholder = clientsLoading
    ? "Loading clients..."
    : clientOptions.length === 0
      ? "No clients available"
      : "Select a client";
  const comboboxDisabled = clientsLoading || clientOptions.length === 0;

  useEffect(() => {
    if (!user) return;
    if (user.metadata?.role === "admin") return;
    if (roleGuardRef.current) return;
    roleGuardRef.current = true;
    toast.error("Access denied. Admin privileges required.");
    router.push("/dashboard");
  }, [user, router]);

  useEffect(() => {
    let isMounted = true;

    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("name, variation_contracted")
          .order("name", { ascending: true });

        if (error) {
          throw error;
        }

        if (isMounted) {
          setClients(data || []);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
        if (isMounted) {
          setClients([]);
          toast.error("Failed to load clients. Please try again.");
        }
      } finally {
        if (isMounted) {
          setClientsLoading(false);
          setPageLoading(false);
        }
      }
    };

    if (isAdmin) {
      fetchClients();
    } else if (user && !isAdmin) {
      setClients([]);
      setClientsLoading(false);
      setPageLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isAdmin, user]);

  useEffect(() => {
    if (!selectedClient) {
      setIsVariationContracted(false);
      return;
    }

    const selected = clients.find(
      (clientOption) => clientOption.name === selectedClient
    );

    setIsVariationContracted(selected?.variation_contracted ?? false);
  }, [clients, selectedClient]);
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
  const lastBatchFetchClientRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedClient) {
      previousClientRef.current = "";
      return;
    }

    if (
      previousClientRef.current &&
      previousClientRef.current !== selectedClient
    ) {
      clearStorage();
      setCsvFile(null);
      setCsvPreview(null);
      setCsvErrors([]);
      setCsvWarnings([]);
      setEditingRow(null);
      setEditedCsvData(null);
      setShowPreviewDialog(false);
      setShowConfirmDialog(false);
      setShowCsvUploadConfirmDialog(false);
      setAdditionalArticleIdInputs({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
          additional_article_ids: [],
        },
      ]);
      setExpandedVariations(new Set());
    }

    previousClientRef.current = selectedClient;
  }, [selectedClient]);

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
    if (!selectedClient) {
      console.warn("Client selection not available for image collection");
      return;
    }

    setCollectingImages(true);

    try {
      const response = await fetch(
        `https://scraper.charpstar.co/process-client/${encodeURIComponent(selectedClient)}`,
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

  // Fetch current batch number for selected client
  useEffect(() => {
    if (!selectedClient) {
      setCurrentBatch(1);
      lastBatchFetchClientRef.current = null;
      return;
    }

    if (lastBatchFetchClientRef.current === selectedClient) {
      return;
    }

    lastBatchFetchClientRef.current = selectedClient;
    let isMounted = true;

    const fetchCurrentBatch = async () => {
      startLoading();
      try {
        const { data, error } = await supabase
          .from("onboarding_assets")
          .select("batch")
          .eq("client", selectedClient)
          .order("batch", { ascending: false })
          .limit(1);

        if (error) {
          throw error;
        }

        if (isMounted) {
          if (data && data.length > 0) {
            setCurrentBatch(data[0].batch + 1);
          } else {
            setCurrentBatch(1);
          }
        }
      } catch (error) {
        console.error("Error fetching current batch:", error);
        if (isMounted) {
          setCurrentBatch(1);
        }
      } finally {
        if (isMounted) {
          stopLoading();
        }
      }
    };

    fetchCurrentBatch();

    return () => {
      isMounted = false;
    };
  }, [selectedClient, startLoading, stopLoading]);

  const addProduct = () => {
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

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const copyProduct = (index: number) => {
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

  const updateProduct = (
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

  const handleOpenArticleIdDialog = (productIndex: number) => {
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
  const removeVariation = (parentIndex: number, variationIndex: number) => {
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
  const updateVariation = (
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
  const toggleVariations = (index: number) => {
    const newExpanded = new Set(expandedVariations);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedVariations(newExpanded);
  };

  const handleSubmit = async () => {
    if (!selectedClient) {
      toast.error("Please select a client before adding products.");
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

    const clientName = selectedClient;

    // Show loading toast
    const loadingToast = toast.loading("Adding products...", {
      description: `Adding ${validProducts.length} product${validProducts.length === 1 ? "" : "s"} to ${clientName} batch ${currentBatch}`,
    });

    try {
      // Declare variables that will be used
      const insertedProducts: any[] = [];
      const allValidProducts: ProductForm[] = [];

      // Helper function to format measurements
      const formatMeasurements = (product: ProductForm) => {
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
      const parentProducts = validProducts.filter((p) => p.is_parent);
      const regularProducts = validProducts.filter(
        (p) => !p.is_parent && !p.parent_article_id
      );

      // Process regular (non-parent) products first
      if (regularProducts.length > 0) {
        const regularProductsToInsert = regularProducts.map((product) => {
          const { primary, articleIds } = buildArticleIdPayload(product);

          return {
            client: clientName,
            batch: currentBatch,
            article_id: primary,
            article_ids: articleIds,
            product_name: product.product_name.trim(),
            product_link: product.product_link.trim(),
            glb_link: product.cad_file_link.trim() || null,
            category: product.category.trim() || null,
            subcategory: product.subcategory.trim() || null,
            reference: null,
            measurements: formatMeasurements(product),
            priority: 2,
            status: "not_started",
            delivery_date: null,
            is_variation: false,
            parent_asset_id: null,
            variation_index: null,
          };
        });

        const { data: regularInserted, error: regularError } = await supabase
          .from("onboarding_assets")
          .insert(regularProductsToInsert)
          .select("id, article_id");

        if (regularError) {
          console.error("Error inserting regular products:", regularError);
          toast.error("Failed to add products. Please try again.", {
            id: loadingToast,
          });
          setLoading(false);
          return;
        }

        insertedProducts.push(...(regularInserted || []));
        allValidProducts.push(...regularProducts);
      }

      // Process parent products with their variations
      for (const parentProduct of parentProducts) {
        // Format measurements for parent
        const parentMeasurementsString = formatMeasurements(parentProduct);

        // Insert parent first
        const { primary: parentPrimary, articleIds: parentArticleIds } =
          buildArticleIdPayload(parentProduct);

        const parentToInsert = {
          client: clientName,
          batch: currentBatch,
          article_id: parentPrimary,
          article_ids: parentArticleIds,
          product_name: parentProduct.product_name.trim(),
          product_link: parentProduct.product_link.trim(),
          glb_link: parentProduct.cad_file_link.trim() || null,
          category: parentProduct.category.trim() || null,
          subcategory: parentProduct.subcategory.trim() || null,
          reference: null,
          measurements: parentMeasurementsString,
          priority: 2,
          status: "not_started",
          delivery_date: null,
          is_variation: false,
          parent_asset_id: null,
          variation_index: null,
        };

        const { data: parentAsset, error: parentError } = await supabase
          .from("onboarding_assets")
          .insert(parentToInsert)
          .select("id, article_id")
          .single();

        if (parentError || !parentAsset) {
          console.error("Error inserting parent product:", parentError);
          toast.error(
            `Failed to add parent product "${parentProduct.product_name}". Please try again.`,
            { id: loadingToast }
          );
          setLoading(false);
          return;
        }

        insertedProducts.push(parentAsset);
        allValidProducts.push(parentProduct);

        // Insert variations if any
        const variations = parentProduct.variations || [];
        const validVariations = variations.filter(
          (v) =>
            v.article_id.trim() &&
            v.product_name.trim() &&
            v.product_link.trim()
        );

        if (validVariations.length > 0) {
          const variationsToInsert = validVariations.map((variation) => {
            const {
              primary: variationPrimary,
              articleIds: variationArticleIds,
            } = buildArticleIdPayload(variation);

            return {
              client: clientName,
              batch: currentBatch,
              article_id: variationPrimary,
              article_ids: variationArticleIds,
              product_name: variation.product_name.trim(),
              product_link: variation.product_link.trim(),
              glb_link: variation.cad_file_link.trim() || null,
              category: variation.category.trim() || null,
              subcategory: variation.subcategory.trim() || null,
              reference: null,
              measurements: formatMeasurements(variation),
              priority: 2,
              status: "not_started",
              delivery_date: null,
              is_variation: true,
              parent_asset_id: parentAsset.id,
              variation_index: variation.variation_index || null,
            };
          });

          const { data: variationsData, error: variationsError } =
            await supabase
              .from("onboarding_assets")
              .insert(variationsToInsert)
              .select("id, article_id");

          if (variationsError) {
            console.error("Error inserting variations:", variationsError);
            toast.error(
              `Failed to add variations for "${parentProduct.product_name}". Please try again.`,
              { id: loadingToast }
            );
            setLoading(false);
            return;
          }

          insertedProducts.push(...(variationsData || []));
          allValidProducts.push(...validVariations);
        }
      }

      // Upload references if any products have them
      // Need to match products with their inserted IDs correctly (including variations)
      let productIndex = 0;
      if (
        insertedProducts &&
        allValidProducts.some(
          (p: ProductForm) => p.references && p.references.length > 0
        )
      ) {
        toast.loading("Uploading references...", {
          id: loadingToast,
          description: "Uploading reference files and URLs",
        });

        // Process regular products
        for (const regularProduct of regularProducts) {
          const insertedProduct = insertedProducts[productIndex];
          if (
            regularProduct.references &&
            regularProduct.references.length > 0 &&
            insertedProduct
          ) {
            const referenceUrls: string[] = [];

            // Upload files and add URLs
            for (const ref of regularProduct.references) {
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
          productIndex++;
        }

        // Process parent products and their variations
        let parentStartIndex = regularProducts.length;
        for (const parentProduct of parentProducts) {
          const parentInserted = insertedProducts[parentStartIndex];
          if (
            parentProduct.references &&
            parentProduct.references.length > 0 &&
            parentInserted
          ) {
            const referenceUrls: string[] = [];

            for (const ref of parentProduct.references) {
              if (ref.type === "file" && ref.file) {
                try {
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

            if (referenceUrls.length > 0) {
              await supabase
                .from("onboarding_assets")
                .update({ reference: referenceUrls.join("|||") })
                .eq("id", parentInserted.id);
            }
          }

          // Process variations for this parent
          const variations = parentProduct.variations || [];
          const validVariations = variations.filter(
            (v) =>
              v.article_id.trim() &&
              v.product_name.trim() &&
              v.product_link.trim()
          );

          parentStartIndex++; // Move past parent

          for (let vIndex = 0; vIndex < validVariations.length; vIndex++) {
            const variation = validVariations[vIndex];
            const variationInserted =
              insertedProducts[parentStartIndex + vIndex];

            if (
              variation.references &&
              variation.references.length > 0 &&
              variationInserted
            ) {
              const referenceUrls: string[] = [];

              for (const ref of variation.references) {
                if (ref.type === "file" && ref.file) {
                  try {
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

              if (referenceUrls.length > 0) {
                await supabase
                  .from("onboarding_assets")
                  .update({ reference: referenceUrls.join("|||") })
                  .eq("id", variationInserted.id);
              }
            }
          }

          parentStartIndex += validVariations.length; // Move past all variations
        }
      }

      // Send notification to admin users about new product submission
      try {
        await notificationService.sendProductSubmissionNotification({
          client: clientName, // Use the same clientName from above
          batch: currentBatch,
          productCount: allValidProducts.length,
          productNames: allValidProducts.map(
            (p: ProductForm) => p.product_name
          ),
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

      // Count parents and variations for success message
      const parentCount = parentProducts.length;
      let variationCount = 0;
      for (const parent of parentProducts) {
        variationCount += (parent.variations || []).filter(
          (v) =>
            v.article_id.trim() &&
            v.product_name.trim() &&
            v.product_link.trim()
        ).length;
      }

      const successMessage =
        isVariationContracted && parentCount > 0
          ? `Successfully added ${parentCount} parent product${parentCount === 1 ? "" : "s"} with ${variationCount} variation${variationCount === 1 ? "" : "s"} for ${clientName} batch ${currentBatch}! (Only parents count toward contract)`
          : `Successfully added ${allValidProducts.length} product${allValidProducts.length === 1 ? "" : "s"} for ${clientName} batch ${currentBatch}!`;

      toast.success(successMessage, {
        id: loadingToast,
        description: `Your products for ${clientName} are now ready for review.`,
        duration: 5000,
      });

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
      console.error("Error adding products:", error);
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
    if (!csvPreview) return;
    if (!selectedClient) {
      toast.error("Please select a client before uploading a CSV.");
      return;
    }

    setLoading(true);
    const client = selectedClient;
    // Use edited data if available, otherwise use original preview
    const dataToUpload = editedCsvData || csvPreview;
    const rows = dataToUpload.slice(1); // skip header

    // Show initial loading toast
    const loadingToast = toast.loading("Preparing products for upload...", {
      description: `Validating and processing CSV data for ${client}`,
    });

    // Prepare all valid products for batch insert
    const productsToInsert = [];
    let failCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip empty rows (check first 4 required fields)
      if (
        !row[0]?.trim() &&
        !row[1]?.trim() &&
        !row[2]?.trim() &&
        !row[3]?.trim()
      ) {
        continue;
      }

      const [
        article_id,
        product_name,
        product_link,
        cad_file_link,
        category,
        subcategory,
      ] = row;

      // Validate required fields
      if (
        !article_id?.trim() ||
        !product_name?.trim() ||
        !product_link?.trim()
      ) {
        failCount++;
        continue;
      }

      const articleTokens = (article_id || "")
        .split(/[|,;\s]+/)
        .map((id) => id.trim())
        .filter(Boolean);
      const primaryArticleId = articleTokens[0] || article_id.trim();
      const articleIdArray = normalizeArticleIdArray(
        primaryArticleId,
        articleTokens.slice(1)
      );

      // Add to batch insert array
      productsToInsert.push({
        client,
        batch: currentBatch,
        article_id: primaryArticleId,
        article_ids: articleIdArray,
        product_name: product_name.trim(),
        product_link: product_link.trim(),
        glb_link: cad_file_link?.trim() || null, // Use the actual CAD/File Link from CSV
        category: category?.trim() || null,
        subcategory: subcategory?.trim() || null,
        reference: null, // No reference column in new format
        priority: 2, // Default priority since not in template
        status: "not_started",
        delivery_date: null,
        upload_order: i + 1, // Preserve the order from CSV
      });
    }

    // Update loading toast
    toast.loading("Uploading products to database...", {
      id: loadingToast,
      description: `Uploading ${productsToInsert.length} products for ${client}`,
    });

    // Batch insert all products at once
    let successCount = 0;
    if (productsToInsert.length > 0) {
      const { error } = await supabase
        .from("onboarding_assets")
        .insert(productsToInsert);

      if (error) {
        console.error("Error batch inserting products:", error);
        toast.error("Failed to upload products. Please try again.", {
          id: loadingToast,
        });
        setLoading(false);
        return;
      }
      successCount = productsToInsert.length;
    }

    setLoading(false);
    setCsvFile(null);
    setCsvPreview(null);
    setCsvErrors([]);
    setCsvWarnings([]);
    setEditingRow(null);
    setEditedCsvData(null);
    setShowPreviewDialog(false); // Close the preview dialog after upload
    resetFileInput();

    if (successCount > 0) {
      // Send notification to admin users about new product submission via CSV
      try {
        const dataToUpload = editedCsvData || csvPreview;
        const rows = dataToUpload.slice(1); // skip header
        const productNames = rows
          .filter((row) => row[1]?.trim()) // filter rows with product names
          .map((row) => row[1].trim())
          .slice(0, successCount); // only include successful uploads

        await notificationService.sendProductSubmissionNotification({
          client: selectedClient,
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
        // Don't fail the product submission if notification fails
      }

      // Automatically collect images in the background (fire and forget)
      collectImages().catch((error) => {
        console.warn("Background image collection failed:", error);
      });

      toast.success(
        `🎉 Successfully uploaded ${successCount} product${successCount === 1 ? "" : "s"} for ${client}!`,
        {
          id: loadingToast,
          description: `Your products for ${client} have been added to batch ${currentBatch} and are ready for review.`,
          duration: 5000,
        }
      );
      // Increment batch number for next use
      setCurrentBatch((prev) => prev + 1);
    }
    if (failCount > 0) {
      toast.error(`${failCount} rows failed to upload.`);
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
      <div className="mb-6 space-y-4 pt-14">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          {selectedClient ? (
            <Badge variant="outline" className="text-sm">
              Client: {selectedClient}
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-sm">
            {selectedClient
              ? `Batch #${currentBatch}`
              : "Select a client to load batch"}
          </Badge>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client
          </Label>
          <div
            className={cn(
              "w-full max-w-sm",
              comboboxDisabled && "opacity-60 pointer-events-none"
            )}
          >
            <Combobox
              value={selectedClient}
              onChange={(value) => {
                setSelectedClient(value);
                setCurrentBatch(1);
              }}
              options={clientOptions}
              placeholder={clientPlaceholder}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Main Form */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-15rem)]">
          <Card className="h-fit shadow-none border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Details
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-2">
                Fill in the required fields (marked with *). Optional fields can
                be left empty.
              </p>
              {!selectedClient && (
                <Alert className="mt-3 border-dashed">
                  <AlertDescription className="text-xs">
                    Select a client above to enable uploads. Product rows will
                    only be submitted once a client is chosen.
                  </AlertDescription>
                </Alert>
              )}
              {isVariationContracted && (
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    Mark any product as a parent using the checkbox, then add
                    variations. Only the parent counts toward your contract
                    limit.
                  </AlertDescription>
                </Alert>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] text-xs">#</TableHead>
                      {isVariationContracted && (
                        <TableHead className="w-[50px] text-xs">
                          Parent
                        </TableHead>
                      )}
                      <TableHead className="w-[110px] text-xs">
                        Article ID *
                      </TableHead>
                      <TableHead className="w-[130px] text-xs">
                        Product Name *
                      </TableHead>
                      <TableHead className="w-[150px] text-xs">
                        Product Link *
                      </TableHead>
                      <TableHead className="w-[150px] text-xs">
                        CAD/File Link
                      </TableHead>
                      <TableHead className="w-[100px] text-xs">
                        Category
                      </TableHead>
                      <TableHead className="w-[100px] text-xs">
                        Subcategory
                      </TableHead>
                      <TableHead className="w-[120px] text-xs">
                        References
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product, index) => {
                      const hasVariations =
                        product.variations && product.variations.length > 0;
                      const isExpanded = expandedVariations.has(index);
                      //eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const productAdditionalKey = getAdditionalInputKey(
                        "product",
                        index
                      );
                      const additionalCount = Array.isArray(
                        product.additional_article_ids
                      )
                        ? product.additional_article_ids.length
                        : 0;
                      const allArticleIds = normalizeArticleIdArray(
                        product.article_id,
                        product.additional_article_ids || []
                      );

                      return (
                        <>
                          <TableRow
                            key={index}
                            className={product.is_parent ? "bg-primary/5" : ""}
                          >
                            <TableCell className="font-medium text-xs">
                              {index + 1}
                            </TableCell>
                            {isVariationContracted && (
                              <TableCell className="p-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      checked={product.is_parent || false}
                                      onCheckedChange={(checked) => {
                                        const isChecked = checked === true;
                                        const updatedProducts = [...products];
                                        updatedProducts[index] = {
                                          ...updatedProducts[index],
                                          is_parent: isChecked,
                                          // Remove variations if unchecking parent
                                          variations: isChecked
                                            ? updatedProducts[index]
                                                .variations || []
                                            : undefined,
                                        };
                                        setProducts(updatedProducts);

                                        if (isChecked && !hasVariations) {
                                          setExpandedVariations(
                                            new Set([
                                              ...expandedVariations,
                                              index,
                                            ])
                                          );
                                        } else if (!isChecked) {
                                          // Remove from expanded set if unchecking
                                          const newExpanded = new Set(
                                            expandedVariations
                                          );
                                          newExpanded.delete(index);
                                          setExpandedVariations(newExpanded);
                                        }
                                      }}
                                    />
                                    {product.is_parent && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Parent
                                      </Badge>
                                    )}
                                    {hasVariations && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => toggleVariations(index)}
                                        className="h-6 w-fit text-xs cursor-pointer ml-auto"
                                        title={
                                          isExpanded
                                            ? "Hide variations"
                                            : "Show variations"
                                        }
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                  {product.is_parent && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setAddVariationsParentIndex(index);
                                        setVariationsCount("1");
                                        setShowAddVariationsDialog(true);
                                      }}
                                      className="h-7 text-xs w-full cursor-pointer px-2"
                                      title="Add variations"
                                    >
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      <span className="text-xs">
                                        Variations
                                      </span>
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="p-2 align-top">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const illegalCharacters =
                                      findIllegalFileCharacters(
                                        product.article_id
                                      );
                                    const showArticleWarning =
                                      illegalCharacters.length > 0 &&
                                      product.article_id.trim().length > 0;

                                    return (
                                      <Tooltip open={showArticleWarning}>
                                        <TooltipTrigger asChild>
                                          <Input
                                            value={product.article_id}
                                            onChange={(e) =>
                                              updateProduct(
                                                index,
                                                "article_id",
                                                e.target.value
                                              )
                                            }
                                            placeholder="ART001"
                                            className={cn(
                                              "h-8 text-xs px-2 font-medium",
                                              showArticleWarning &&
                                                "border-amber-400 focus-visible:ring-amber-500 focus-visible:ring-offset-0"
                                            )}
                                            aria-invalid={showArticleWarning}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent
                                          variant="warning"
                                          side="top"
                                          align="start"
                                          sideOffset={6}
                                        >
                                          <div className="flex flex-col gap-1">
                                            <span>
                                              Article ID contains characters
                                              that cannot be used in file names.
                                            </span>
                                            <span className="font-semibold">
                                              Replace{" "}
                                              {illegalCharacters.join(" ")} with
                                              &quot;-&quot; and your files will
                                              still connect to this article ID.
                                            </span>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                  {additionalCount > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-primary"
                                        >
                                          <Layers className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-xs bg-popover/95 text-foreground border border-border shadow-md backdrop-blur">
                                        <div className="space-y-1">
                                          <p className="font-medium">
                                            Linked article IDs
                                          </p>
                                          <div className="space-y-0.5">
                                            {allArticleIds.map((id) => (
                                              <div
                                                key={id}
                                                className="text-muted-foreground"
                                              >
                                                {id}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-8 min-w-8"
                                        onClick={() =>
                                          handleOpenArticleIdDialog(index)
                                        }
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      Add more IDs
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={product.product_name}
                                onChange={(e) =>
                                  updateProduct(
                                    index,
                                    "product_name",
                                    e.target.value
                                  )
                                }
                                placeholder="Name"
                                className="h-7 text-xs px-2"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={product.product_link}
                                onChange={(e) =>
                                  updateProduct(
                                    index,
                                    "product_link",
                                    e.target.value
                                  )
                                }
                                placeholder="Link"
                                className="h-7 text-xs px-2"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={product.cad_file_link}
                                onChange={(e) =>
                                  updateProduct(
                                    index,
                                    "cad_file_link",
                                    e.target.value
                                  )
                                }
                                placeholder="CAD Link"
                                className="h-7 text-xs px-2"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={product.category}
                                onChange={(e) =>
                                  updateProduct(
                                    index,
                                    "category",
                                    e.target.value
                                  )
                                }
                                placeholder="Category"
                                className="h-7 text-xs px-2"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                value={product.subcategory}
                                onChange={(e) =>
                                  updateProduct(
                                    index,
                                    "subcategory",
                                    e.target.value
                                  )
                                }
                                placeholder="Subcat"
                                className="h-7 text-xs px-2"
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <div className="flex gap-0.5 items-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingReferencesIndex(index);
                                    setShowReferencesDialog(true);
                                  }}
                                  className="h-7 text-xs cursor-pointer px-2"
                                >
                                  <FileText className="h-3 w-3 mr-0.5" />
                                  {(() => {
                                    const refCount = product.references.length;
                                    const hasMeasurements =
                                      product.measurements &&
                                      (product.measurements.height?.trim() ||
                                        product.measurements.width?.trim() ||
                                        product.measurements.depth?.trim());
                                    const totalCount =
                                      refCount + (hasMeasurements ? 1 : 0);
                                    return totalCount > 0 ? totalCount : "Add";
                                  })()}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyProduct(index)}
                                  className="h-6 w-6 text-primary hover:text-primary/80 hover:bg-primary/10 cursor-pointer"
                                  title="Copy row"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {products.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeProduct(index)}
                                    className="h-6 w-6 text-error hover:text-error/80 hover:bg-error/10 cursor-pointer ml-auto"
                                    title="Remove product"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Variations rows */}
                          {isExpanded &&
                            hasVariations &&
                            product.variations?.map((variation, vIndex) => (
                              <TableRow
                                key={`${index}-var-${vIndex}`}
                                className="bg-muted/30"
                              >
                                <TableCell className="font-medium text-muted-foreground text-xs p-2">
                                  <div className="flex items-center gap-1">
                                    <ChevronRight className="h-3 w-3" />V
                                    {variation.variation_index}
                                  </div>
                                </TableCell>
                                {isVariationContracted && (
                                  <TableCell className="p-2" />
                                )}
                                <TableCell className="p-2">
                                  {(() => {
                                    const variationIllegalCharacters =
                                      findIllegalFileCharacters(
                                        variation.article_id
                                      );
                                    const showVariationWarning =
                                      variationIllegalCharacters.length > 0 &&
                                      variation.article_id.trim().length > 0;

                                    return (
                                      <Tooltip open={showVariationWarning}>
                                        <TooltipTrigger asChild>
                                          <Input
                                            value={variation.article_id}
                                            onChange={(e) =>
                                              updateVariation(
                                                index,
                                                vIndex,
                                                "article_id",
                                                e.target.value
                                              )
                                            }
                                            placeholder="ART001-V1"
                                            className={cn(
                                              "h-7 text-xs bg-background px-2",
                                              showVariationWarning &&
                                                "border-amber-400 focus-visible:ring-amber-500 focus-visible:ring-offset-0"
                                            )}
                                            aria-invalid={showVariationWarning}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent
                                          variant="warning"
                                          side="top"
                                          align="start"
                                          sideOffset={6}
                                        >
                                          <div className="flex flex-col gap-1">
                                            <span>
                                              Article ID contains characters
                                              that cannot be used in file names.
                                            </span>
                                            <span className="font-semibold">
                                              Replace{" "}
                                              {variationIllegalCharacters.join(
                                                " "
                                              )}{" "}
                                              with &quot;-&quot; and your files
                                              will still connect to this article
                                              ID.
                                            </span>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="p-2">
                                  <Input
                                    value={variation.product_name}
                                    onChange={(e) =>
                                      updateVariation(
                                        index,
                                        vIndex,
                                        "product_name",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Name"
                                    className="h-7 text-xs bg-background px-2"
                                  />
                                </TableCell>
                                <TableCell className="p-2">
                                  <Input
                                    value={variation.product_link}
                                    onChange={(e) =>
                                      updateVariation(
                                        index,
                                        vIndex,
                                        "product_link",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Link"
                                    className="h-7 text-xs bg-background px-2"
                                  />
                                </TableCell>
                                <TableCell className="p-2">
                                  <Input
                                    value={variation.cad_file_link}
                                    onChange={(e) =>
                                      updateVariation(
                                        index,
                                        vIndex,
                                        "cad_file_link",
                                        e.target.value
                                      )
                                    }
                                    placeholder="CAD Link"
                                    className="h-7 text-xs bg-background px-2"
                                  />
                                </TableCell>
                                <TableCell className="p-2">
                                  <Input
                                    value={variation.category}
                                    onChange={(e) =>
                                      updateVariation(
                                        index,
                                        vIndex,
                                        "category",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Category"
                                    className="h-7 text-xs bg-background px-2"
                                  />
                                </TableCell>
                                <TableCell className="p-2">
                                  <Input
                                    value={variation.subcategory}
                                    onChange={(e) =>
                                      updateVariation(
                                        index,
                                        vIndex,
                                        "subcategory",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Subcat"
                                    className="h-7 text-xs bg-background px-2"
                                  />
                                </TableCell>
                                <TableCell className="p-2">
                                  <div className="flex gap-0.5 items-center">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingVariationRef({
                                          parentIndex: index,
                                          variationIndex: vIndex,
                                        });
                                        setEditingReferencesIndex(null);
                                        setShowReferencesDialog(true);
                                      }}
                                      className="h-7 text-xs cursor-pointer px-2"
                                    >
                                      <FileText className="h-3 w-3 mr-0.5" />
                                      {(() => {
                                        const refCount =
                                          variation.references?.length || 0;
                                        const hasMeasurements =
                                          variation.measurements &&
                                          (variation.measurements.height?.trim() ||
                                            variation.measurements.width?.trim() ||
                                            variation.measurements.depth?.trim());
                                        const totalCount =
                                          refCount + (hasMeasurements ? 1 : 0);
                                        return totalCount > 0
                                          ? totalCount
                                          : "Add";
                                      })()}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        removeVariation(index, vIndex)
                                      }
                                      className="h-6 w-6 text-error hover:text-error/80 hover:bg-error/10 cursor-pointer ml-auto"
                                      title="Remove variation"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center pt-4 border-t">
                <Button
                  onClick={addProduct}
                  variant="outline"
                  className="w-full sm:w-auto cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Product
                </Button>

                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <Input
                    value={addMultipleProducts}
                    onChange={(e) => setAddMultipleProducts(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addMultipleLinesFunction();
                      }
                    }}
                    className="h-7 text-xs w-15"
                    type="number"
                    min="1"
                    max="100"
                  />
                  <Button
                    onClick={addMultipleLinesFunction}
                    variant="outline"
                    size="xxs"
                    className="cursor-pointer"
                    disabled={!addMultipleProducts.trim()}
                  >
                    Add {addMultipleProducts.trim() || "0"} Row
                    {addMultipleProducts.trim() !== "1" ? "s" : ""}
                  </Button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => {
                    if (!selectedClient) {
                      toast.error(
                        "Please select a client before reviewing products."
                      );
                      return;
                    }
                    setShowConfirmDialog(true);
                  }}
                  disabled={
                    loading ||
                    getValidProducts().length === 0 ||
                    !selectedClient
                  }
                  className="flex-1 cursor-pointer"
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
            </CardContent>
          </Card>
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
                    onClick={() => {
                      if (!selectedClient) {
                        toast.error(
                          "Select a client before previewing CSV uploads."
                        );
                        return;
                      }
                      setShowPreviewDialog(true);
                    }}
                    variant="outline"
                    className="w-full cursor-pointer"
                    disabled={!selectedClient}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview {csvPreview.length - 1} Products
                  </Button>

                  <Button
                    onClick={() => {
                      if (!selectedClient) {
                        toast.error(
                          "Select a client before uploading products."
                        );
                        return;
                      }
                      setShowCsvUploadConfirmDialog(true);
                    }}
                    disabled={loading || !selectedClient}
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
              Review Products for{" "}
              {selectedClient ? (
                <span className="font-semibold">{selectedClient}</span>
              ) : (
                "the selected client"
              )}{" "}
              Before Adding to Batch {currentBatch}
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
              Confirm CSV Upload for{" "}
              {selectedClient ? (
                <span className="font-semibold">{selectedClient}</span>
              ) : (
                "the selected client"
              )}
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
