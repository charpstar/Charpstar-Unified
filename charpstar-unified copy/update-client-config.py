#!/usr/bin/env python3
"""
Script to update the renderer client configuration for Next.js server
"""

import os
import sys

def update_client_config():
    """Update the client configuration to work with Next.js server"""
    
    # Path to the client file
    client_path = "/Users/karthikrajagopalan/Downloads/Render-Automator/renderer_client.py"
    
    if not os.path.exists(client_path):
        print(f"Client file not found at: {client_path}")
        return False
    
    # Read the current file
    with open(client_path, 'r') as f:
        content = f.read()
    
    # Update the server URL and API URL
    updated_content = content.replace(
        'SERVER_URL = "https://charpstar.co"',
        'SERVER_URL = "http://localhost:3000"'
    ).replace(
        'API_URL = f"{SERVER_URL}/renderproducts/api"',
        'API_URL = f"{SERVER_URL}/api/product-render"'
    )
    
    # Create backup
    backup_path = client_path + ".backup"
    with open(backup_path, 'w') as f:
        f.write(content)
    print(f"Backup created at: {backup_path}")
    
    # Write updated content
    with open(client_path, 'w') as f:
        f.write(updated_content)
    
    print("✅ Client configuration updated successfully!")
    print("\nChanges made:")
    print("- SERVER_URL changed to http://localhost:3000")
    print("- API_URL changed to /api/product-render")
    print("\nTo test the client:")
    print("1. Start your Next.js server: npm run dev")
    print("2. Run the client: python renderer_client.py")
    
    return True

if __name__ == "__main__":
    update_client_config()

