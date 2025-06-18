// src/config/clientConfig.ts

// Comprehensive client configuration interface
export interface ClientConfig {
  // Basic info
  name: string;
  description?: string;

  // URLs and paths
  modelUrl: string;
  hdrPath: string;
  scriptPath: string;
  resourcesPath: string;

  // Security
  livePassword: string;

  // BunnyCDN specific paths
  bunnyCdn: {
    basePath: string;
    resourcesFolder: string;
    imagesFolder: string;
  };
}

// Default configuration to use as fallback
const DEFAULT_CONFIG: ClientConfig = {
  name: "Default",
  description: "Default Configuration",
  modelUrl: "",
  hdrPath: "https://cdn.charpstar.net/HDR/default.hdr",
  scriptPath: "/model-viewer.js",
  resourcesPath: "",
  livePassword: "",
  bunnyCdn: {
    basePath: "Client-Editor/Default",
    resourcesFolder: "resources",
    imagesFolder: "images",
  },
};

// Add Supabase fetch function
import { supabase } from "../lib/supabaseClient";

export const fetchClientConfig = async (
  clientName: string
): Promise<ClientConfig> => {
  try {
    console.log("Fetching config for client:", clientName);
    const { data, error } = await supabase
      .from("client_configs")
      .select("*")
      .eq("name", clientName)
      .single();

    if (error) {
      console.error("Supabase error fetching client config:", error.message);
      return DEFAULT_CONFIG;
    }

    if (!data) {
      console.warn("No config found for client:", clientName);
      return DEFAULT_CONFIG;
    }

    console.log("Fetched config for client:", clientName, data);
    // Map snake_case to camelCase
    const mapped: ClientConfig = {
      name: data.name,
      description: data.description,
      modelUrl: data.model_url,
      hdrPath: data.hdr_path,
      scriptPath: data.script_path,
      resourcesPath: data.resources_path,
      livePassword: data.live_password,
      bunnyCdn: {
        basePath: data.bunny_base_path,
        resourcesFolder: data.bunny_resources_folder,
        imagesFolder: data.bunny_images_folder,
      },
    };
    return mapped;
  } catch (err) {
    console.error("Unexpected error fetching client config:", err);
    return DEFAULT_CONFIG;
  }
};

// Helper function to get all available client names
export const fetchAvailableClients = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from("client_configs")
      .select("name")
      .order("name");

    if (error) {
      console.error("Error fetching client names:", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn("No clients found in the database");
      return [];
    }

    console.log("Fetched clients:", data);
    return data.map((client) => client.name);
  } catch (err) {
    console.error("Unexpected error fetching client names:", err);
    return [];
  }
};

// Helper function to get the default client name
export const getDefaultClientName = async (): Promise<string> => {
  const clients = await fetchAvailableClients();
  return clients[0] || "Default";
};

// Helper to check if a client should use the Sweef viewer
export const usesSweefViewer = async (clientName: string): Promise<boolean> => {
  const config = await fetchClientConfig(clientName);
  return config.scriptPath === "/sweef-viewer-13.js";
};

// Helper to check if a client is valid
export const isValidClient = async (clientName: string): Promise<boolean> => {
  const clients = await fetchAvailableClients();
  return clients.includes(clientName);
};
