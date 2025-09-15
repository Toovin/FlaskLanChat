# FlaskLanChat - LAN Chat Application

A real-time chat application built with Flask, SocketIO, and SQLite for local network communication.

## 🤖 AI-Generated Configuration Notice

**⚠️ IMPORTANT: This project was automatically generalized and configured via AI assistance.**

The configuration has been standardized to:
- **Port**: 6970 (HTTPS)
- **Databases**: `devchat.db` and `dev-adventure.db`
- **IP Settings**: Generalized for network deployment

### 🔧 Verification Required
Before running the server, please verify:

1. **IP Addresses**: All IP addresses in configuration files match your network setup
2. **Dependencies**: Run `pip install -r requirements.txt` to ensure compatibility
3. **SSL Certificates**: Generate certificates with your actual server IP addresses
4. **Database Files**: Ensure `devchat.db` and `dev-adventure.db` are properly initialized

### 🐛 Troubleshooting AI-Generated Code
If you encounter issues:
- **Check Configuration Files**: Verify all JSON configs have correct IPs
- **Review Code Logic**: AI-generated code may need manual review for edge cases
- **Test Incrementally**: Start with basic functionality before enabling extensions
- **Check Logs**: Look for specific error messages in server output
- **Manual Code Review**: Consider reviewing and potentially modifying generated code sections

**💡 Pro Tip**: AI can generalize code effectively, but human verification ensures reliability!

## ⚠️ CRITICAL: IP Configuration Required Before First Run

**STOP!** Before running the server, you **MUST** configure IP addresses for all services. The server runs on **port 6970** with databases `devchat.db` and `dev-adventure.db`.

### 🔧 Required IP Configurations

#### 1. **General Server Connections** (Port 6970)
- **Purpose**: Main chat server and web interface
- **Files to Update**:
  - `generate_cert.py` - SSL certificate IP addresses
  - `generate_certs.bat` / `generate_certs.sh` - Certificate generation scripts
- **Current Config**: Server binds to `0.0.0.0:6970` (all interfaces)
- **SSL Required**: Generate certificates with your server IP(s)

#### 2. **RTSP Frame Capture** (Chicken Pic Extension)
- **Purpose**: Camera feed capture for image processing
- **File**: `chicken_pic_config.json`
- **Setting**: `"rtsp_url": "rtsp://[YOUR_CAMERA_IP]:8554/cam"`
- **Example**: `"rtsp_url": "rtsp://192.168.1.100:8554/cam"`

#### 3. **SD Integration** (ForgeUI Image API)
- **Purpose**: Stable Diffusion image generation
- **File**: `sd_config.json`
- **Setting**: `"sd_api_url": "http://[YOUR_SD_SERVER_IP]:7872"`
- **Example**: `"sd_api_url": "http://192.168.1.101:7872"`

#### 4. **EAI Integration** (AI Chat)
- **Purpose**: AI-powered chat responses
- **File**: `eai_config.json`
- **Setting**: `"eai_api_url": "http://[YOUR_EAI_SERVER_IP]:12340/v1/chat/completions"`
- **Example**: `"eai_api_url": "http://192.168.1.102:12340/v1/chat/completions"` 
- EAI = External AI (think chat bot, vision llm, etc)
## 📋 Configuration Checklist

### ✅ Pre-Flight Check
Before running `python server_v5.py`, ensure:

1. **IP Addresses Configured** in all JSON config files
2. **SSL Certificates Generated** with your server IP(s)
3. **Databases Initialized** (`devchat.db` and `dev-adventure.db`)
4. **Port 6970 Available** (not blocked by firewall)
5. **Python Dependencies Installed** (`pip install -r requirements.txt`)

### 🔧 Service Configuration Details

#### **Main Server** (Port 6970)
- **Host**: `0.0.0.0` (all network interfaces)
- **SSL**: Required for HTTPS
- **Database**: `devchat.db`
- **Frontend**: `static/core.js` (auto-connects to port 6970)

#### **RTSP Camera Service**
- **Config File**: `chicken_pic_config.json`
- **URL Format**: `rtsp://[CAMERA_IP]:8554/cam`
- **Purpose**: Live camera feed capture

#### **Stable Diffusion API**
- **Config File**: `sd_config.json`
- **URL Format**: `http://[SD_SERVER_IP]:7872`
- **Purpose**: AI image generation

#### **AI Chat Service**
- **Config File**: `eai_config.json`
- **URL Format**: `http://[AI_SERVER_IP]:12340/v1/chat/completions`
- **Purpose**: AI-powered chat responses

### 🗄️ Database Configuration
- **Main Chat DB**: `devchat.db` (messages, users, channels)
- **Adventure DB**: `dev-adventure.db` (city management system)

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Run the interactive setup script
python setup.py
```
This will automatically:
- Configure all IP addresses for your services
- Generate SSL certificates
- Initialize databases
- Provide clear next steps

### Option 2: Manual Setup

#### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 2. Configure IP Addresses
Update the following files with your network IPs:
- `chicken_pic_config.json` - RTSP camera IP
- `sd_config.json` - Stable Diffusion server IP
- `eai_config.json` - AI chat server IP

#### 3. Generate SSL Certificates
```bash
# Automated (recommended)
python generate_cert.py

# Or manual scripts:
# Windows: generate_certs.bat
# Linux/Mac: ./generate_certs.sh
```

#### 4. Initialize Databases
```bash
python init_db.py
python init_adventure_db.py
```

#### 5. Run the Server
```bash
python server_v5.py
```

The server will start on `https://[YOUR_IP]:6970`

## Configuration Files

### IP Address Configuration Checklist
Before running, update these files with your network IPs:

1. **`chicken_pic_config.json`** - RTSP camera IP
2. **`sd_config.json`** - Stable Diffusion API server IP
3. **`eai_config.json`** - AI chat API server IP
4. **`generate_cert.py`** - SSL certificate IP addresses

### JavaScript Configuration
The frontend (`static/core.js`) automatically connects to the same host/port as the web page, so no manual configuration needed.

## HTTPS Setup

### Certificate Generation
The application requires SSL certificates for HTTPS. Two methods are available:

#### Method 1: Automated Script
Use the provided batch/shell scripts:
- Windows: `generate_certs.bat`
- Linux/Mac: `generate_certs.sh`

#### Method 2: Manual Generation
```bash
python generate_cert.py
```

#### Method 3: OpenSSL Command
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=CA/L=Network/O=FlaskLanChat/CN=your-server-ip" -addext "subjectAltName=IP:your-server-ip"
```

## Features

- Real-time messaging with SocketIO
- File sharing and image uploads
- User authentication and channels
- RTSP camera integration
- Stable Diffusion image generation
- AI chat integration
- Thumbnail generation
- Mobile-responsive interface

## Development

### Running Tests
```bash
python test_command_execution.py
python test_connection_stability.py
# ... run other test_*.py files as needed
```

### Project Structure
```
├── server_v5.py              # Main Flask application
├── lc_*.py                   # Core application modules
├── static/                   # Frontend assets
├── extensions/               # Extension modules
├── chicken_pic_config.json   # RTSP configuration
├── sd_config.json           # SD API configuration
├── eai_config.json          # AI API configuration
├── requirements.txt          # Python dependencies
└── generate_cert.py         # SSL certificate generator
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**: Regenerate certificates with correct IP addresses
2. **Connection Refused**: Check firewall settings and port 6970 availability
3. **RTSP Connection Failed**: Verify camera IP in `chicken_pic_config.json`
4. **SD API Errors**: Check Stable Diffusion server IP in `sd_config.json`
5. **Database Errors**: Ensure write permissions in the project directory

### Network Configuration
- Ensure port 6970 is open in your firewall
- Update all IP addresses in configuration files to match your network
- For LAN access, use your server's local IP address instead of localhost</content>
</xai:function_call: write>
<parameter name="filePath">J:\pythonProject\FlaskLanChat_Dev\dev5f\README.md