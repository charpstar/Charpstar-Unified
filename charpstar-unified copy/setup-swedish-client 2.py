#!/usr/bin/env python3
"""
Setup script for Swedish client configuration
"""

import os
import sys

def setup_swedish_client():
    """Configure the renderer client for Swedish PC"""
    
    print("🇸🇪 Setting up Swedish Client Configuration")
    print("=" * 50)
    
    # Get user input for configuration
    print("\n1. Server Configuration:")
    server_url = input("Enter your server URL (e.g., https://your-domain.com): ").strip()
    if not server_url:
        server_url = "https://your-domain.com"
        print(f"Using default: {server_url}")
    
    print("\n2. Blender Configuration:")
    blender_path = input("Enter Blender path (e.g., C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe): ").strip()
    if not blender_path:
        blender_path = r"C:\Program Files\Blender Foundation\Blender 4.3\blender.exe"
        print(f"Using default: {blender_path}")
    
    print("\n3. Render Script Configuration:")
    render_script = input("Enter render script path (e.g., C:\\Users\\Username\\Documents\\renderer\\render2.py): ").strip()
    if not render_script:
        render_script = r"C:\Users\Username\Documents\renderer\render2.py"
        print(f"Using default: {render_script}")
    
    print("\n4. Lighting Setup Configuration:")
    lighting_setup = input("Enter lighting setup path (e.g., C:\\Users\\Username\\Documents\\renderer\\2.blend): ").strip()
    if not lighting_setup:
        lighting_setup = r"C:\Users\Username\Documents\renderer\2.blend"
        print(f"Using default: {lighting_setup}")
    
    print("\n5. Output Directory Configuration:")
    output_dir = input("Enter output directory (e.g., C:\\Renders): ").strip()
    if not output_dir:
        output_dir = r"C:\Renders"
        print(f"Using default: {output_dir}")
    
    # Create the updated client configuration
    client_config = f'''# Swedish Client Configuration
# Generated on: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

# Server Configuration
SERVER_URL = "{server_url}"
API_URL = f"{{SERVER_URL}}/api/product-render"

# Blender Configuration
BLENDER_PATH = r"{blender_path}"
RENDER_SCRIPT = r"{render_script}"
LIGHTING_SETUP = r"{lighting_setup}"
OUTPUT_DIR = r"{output_dir}"

# Network Configuration
POLL_INTERVAL = 20  # Check for new jobs every 20 seconds
TIMEOUT = 30  # Request timeout in seconds

# Swedish PC Specific Settings
import os
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Logging Configuration
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('renderer_client.log'),
        logging.StreamHandler()
    ]
)
'''
    
    # Write configuration to file
    config_file = "swedish_client_config.py"
    with open(config_file, 'w') as f:
        f.write(client_config)
    
    print(f"\n✅ Configuration saved to: {config_file}")
    print("\n📋 Next Steps for Swedish PC:")
    print("1. Install Python 3.8+ if not already installed")
    print("2. Install required packages: pip install requests")
    print("3. Install Blender 4.3+ from https://www.blender.org/download/")
    print("4. Copy render2.py and 2.blend files to the specified directories")
    print("5. Create the output directory if it doesn't exist")
    print("6. Test the connection: python test_connection.py")
    print("7. Run the client: python renderer_client.py")
    
    return config_file

def create_test_script():
    """Create a test script to verify connection"""
    
    test_script = '''#!/usr/bin/env python3
"""
Test script to verify Swedish client connection
"""

import requests
import sys

def test_connection():
    """Test connection to the server"""
    try:
        # Test server connectivity
        response = requests.get(f"{SERVER_URL}/api/product-render/jobs", timeout=10)
        if response.status_code == 200:
            print("✅ Server connection successful!")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ Server returned status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    # Import configuration
    try:
        from swedish_client_config import SERVER_URL
    except ImportError:
        print("❌ Configuration file not found. Run setup_swedish_client.py first.")
        sys.exit(1)
    
    print("🧪 Testing Swedish Client Connection")
    print("=" * 40)
    
    if test_connection():
        print("\\n🎉 Swedish client is ready to use!")
    else:
        print("\\n❌ Please check your configuration and network connection.")
'''
    
    with open("test_connection.py", 'w') as f:
        f.write(test_script)
    
    print("✅ Test script created: test_connection.py")

if __name__ == "__main__":
    setup_swedish_client()
    create_test_script()

