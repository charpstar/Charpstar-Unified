# 🇸🇪 Swedish Client Setup Guide

## Prerequisites

### 1. Software Requirements
- **Python 3.8+** (Download from python.org)
- **Blender 4.3+** (Download from blender.org)
- **Stable Internet Connection** (for downloading GLB files and uploading results)

### 2. File Requirements
- `renderer_client.py` (main client script)
- `render2.py` (Blender render script)
- `2.blend` (lighting setup file)

## Setup Steps

### Step 1: Install Python
```bash
# Download Python from https://www.python.org/downloads/
# Make sure to check "Add Python to PATH" during installation
python --version  # Should show Python 3.8+
```

### Step 2: Install Required Packages
```bash
pip install requests
```

### Step 3: Install Blender
1. Download Blender 4.3+ from https://www.blender.org/download/
2. Install to default location: `C:\Program Files\Blender Foundation\Blender 4.3\`
3. Note the exact path for configuration

### Step 4: Create Directory Structure
```bash
# Create directories
mkdir C:\Users\%USERNAME%\Documents\renderer
mkdir C:\Renders
```

### Step 5: Copy Required Files
Copy these files to the Swedish PC:
- `renderer_client.py` → Any location
- `render2.py` → `C:\Users\[Username]\Documents\renderer\`
- `2.blend` → `C:\Users\[Username]\Documents\renderer\`

### Step 6: Configure Client
Run the setup script:
```bash
python setup-swedish-client.py
```

### Step 7: Test Connection
```bash
python test_connection.py
```

### Step 8: Run Client
```bash
python renderer_client.py
```

## Network Configuration

### Firewall Settings
- Allow Python.exe through Windows Firewall
- Allow Blender.exe through Windows Firewall
- Ensure port 443 (HTTPS) is accessible

### Proxy Settings (if applicable)
If behind a corporate firewall, configure proxy:
```python
# Add to renderer_client.py
import os
os.environ['HTTP_PROXY'] = 'http://proxy.company.com:8080'
os.environ['HTTPS_PROXY'] = 'http://proxy.company.com:8080'
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check internet connection
   - Verify server URL is correct
   - Test with: `python test_connection.py`

2. **Blender Not Found**
   - Verify Blender installation path
   - Check if Blender is in system PATH
   - Test manually: `blender --version`

3. **Permission Errors**
   - Run as Administrator if needed
   - Check file permissions for output directory
   - Ensure write access to C:\Renders

4. **GLB Download Issues**
   - Check if GLB URLs are accessible
   - Verify network connectivity to external URLs
   - Test with a sample GLB file

### Performance Optimization

1. **Network Settings**
   ```python
   # Increase timeout for slower connections
   TIMEOUT = 60  # seconds
   POLL_INTERVAL = 30  # seconds
   ```

2. **Blender Settings**
   - Use GPU rendering if available
   - Adjust render quality based on network speed
   - Consider using lower resolution for faster uploads

## Monitoring

### Log Files
- Client logs: `renderer_client.log`
- Blender logs: Check Blender console output
- System logs: Windows Event Viewer

### Health Checks
- Monitor disk space in output directory
- Check internet connectivity regularly
- Verify Blender is working correctly

## Security Considerations

1. **File Access**
   - Restrict access to render directories
   - Use secure file sharing if needed
   - Regular cleanup of temporary files

2. **Network Security**
   - Use HTTPS for all communications
   - Consider VPN if required by company policy
   - Monitor for unusual network activity

## Maintenance

### Regular Tasks
- Clean up old render files
- Update Blender if needed
- Monitor disk space
- Check client logs for errors

### Updates
- Keep Python packages updated
- Update Blender when new versions are released
- Update client script when server changes

## Support

### Log Collection
When reporting issues, collect:
- `renderer_client.log`
- System specifications
- Network configuration
- Error messages

### Contact Information
- Technical support: [Your contact info]
- Server status: [Your server status page]
- Documentation: [Your documentation URL]

