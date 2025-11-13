#!/usr/bin/env python3
"""
Test script to verify the Next.js API endpoints work with the client
"""

import requests
import json

def test_api_endpoints():
    """Test the API endpoints to ensure they work with the client"""
    
    base_url = "http://localhost:3000"
    api_url = f"{base_url}/api/product-render"
    
    print("🧪 Testing Next.js API endpoints...")
    print(f"Base URL: {base_url}")
    print(f"API URL: {api_url}")
    
    # Test 1: Health check (if available)
    try:
        response = requests.get(f"{api_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check endpoint working")
        else:
            print("⚠️  Health check endpoint not found (this is optional)")
    except:
        print("⚠️  Health check endpoint not available")
    
    # Test 2: Get next job (should return no jobs initially)
    try:
        response = requests.get(f"{api_url}/jobs/next", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'no_jobs':
                print("✅ Jobs/next endpoint working (no jobs available)")
            else:
                print(f"✅ Jobs/next endpoint working (found job: {data.get('job_id')})")
        else:
            print(f"❌ Jobs/next endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Jobs/next endpoint error: {e}")
    
    # Test 3: List jobs
    try:
        response = requests.get(f"{api_url}/jobs", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Jobs list endpoint working ({len(data.get('jobs', []))} jobs)")
        else:
            print(f"❌ Jobs list endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Jobs list endpoint error: {e}")
    
    # Test 4: Submit a test job
    try:
        test_job = {
            "products": [
                {
                    "id": "test-1",
                    "product_name": "Test Product",
                    "glb_link": "https://example.com/test.glb"
                }
            ],
            "settings": {
                "resolution": "2048x2048",
                "imageFormat": "JPEG",
                "bgColor": "#ffffff",
                "transparentBg": False,
                "quality": "medium",
                "cameraViews": ["front", "side"]
            }
        }
        
        response = requests.post(
            f"{api_url}/jobs",
            json=test_job,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            job_id = data.get('job', {}).get('id')
            print(f"✅ Job submission working (Job ID: {job_id})")
            
            # Test 5: Get the job we just created
            if job_id:
                try:
                    response = requests.get(f"{api_url}/jobs/{job_id}/status", timeout=5)
                    if response.status_code == 200:
                        print("✅ Job status endpoint working")
                    else:
                        print(f"❌ Job status endpoint failed: {response.status_code}")
                except Exception as e:
                    print(f"❌ Job status endpoint error: {e}")
        else:
            print(f"❌ Job submission failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Job submission error: {e}")
    
    print("\n🎯 Summary:")
    print("If all tests show ✅, your Next.js API is ready for the client!")
    print("If any show ❌, check your Next.js server is running on port 3000")

if __name__ == "__main__":
    test_api_endpoints()

