# FlaskLanChat - LAN Chat Application

A grassroots, feature-rich LAN-only chat server developed solo in 3 months to address the lack of open-hood, customizable offline chat experiences. Approximately 70% bug-free, it serves as a boilerplate for AI experimentation and network-based communication (works with VPNs and large networks too!). Built with Flask, SocketIO, and SQLite, featuring AI chat, image generation, and voice/video capabilities.

## ✨ Features

### Core Features
- **Real-time Messaging**: Instant messaging with SocketIO and hopefully no errors!
- **File Sharing**: Upload and share images, documents, and media files in a probably very insecure manner other than https. 
- **User Authentication**: Secure user management with channels. Sorta. Don't trust it. 
- **NOT Mobile Responsive**: Does not work seamlessly on mobile devices
- **Thumbnail Generation**: Complicate simple actions via automatic thumbnails for uploaded media. Clients need better caching / long term storage to potentially make better use of this. 

### Extensions & Integrations
- **AI Chat Integration**: Connect to external AI services for chat responses. Currently only configured for a local LM Studio implementation. 
- **Stable Diffusion**: AI-powered image generation - modified A1111/ForgeUI (Windows) api endpoint. ENDPOINT MUST ACCEPT PLACEHOLD IMAGEDATA WITH FORGEUI, MODIFY ENDPOINT, ASK GROK ABOUT THIS.
- **RTSP Camera**: Live camera feed capture and processing via !chicken command (MediaMTX Chicken coop camera, however, use the logic for your cameras!)
- **VoiceChat**: WebRTC-based voice and video chat with screen sharing and errors and potentially race conditions that cause problems - complicated with STUN incase you have network interfaces and hyper-v virtual switch creating chutes and ladders of internal struggles. 
- **Fun Commands**: Dice rolling and interactive commands - take a chance and roll the dice!

### Advanced Features
- **Reactions**: Message reactions - convince other chat members you thought about their message
- **AI Characters**: Create unique or basic characters to flavor your AI experience!
- **Extension Framework**: Basic extension system (TBD on full scope)

## 🚀 Quick Start

### Automated Setup (Recommended)
```bash
# Run the interactive setup script
python setup.py
```

### Manual Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure IP addresses in JSON config files
# 3. Generate SSL certificates
python generate_cert.py

# 4. Initialize databases
python init_db.py

# 5. Run the server
python server_v1_a.py
```

The server will start on `https://[YOUR_IP]:6969`

## 📋 Configuration

### Network Configuration
FlaskLanChat is designed to work in complex network environments with multiple interfaces (WiFi, Ethernet, VPN). The server will be accessible on all configured IPs.

**Finding Your Server IP:**
- **Simple Networks**: Use your computer's LAN IP (typically 192.168.1.x or 10.0.0.x)
- **Multiple Interfaces**: Choose the IP where clients will connect (usually Ethernet for stability)
- **Windows**: Run `ipconfig` in Command Prompt
- **Linux/Mac**: Run `ip addr show` or `ifconfig`

### Required Service Configurations
Configure these services with your network IPs before first run:

1. **RTSP Camera** (`chicken_pic_config.json`) -- OPTIONAL!
    - `"rtsp_url": "rtsp://[CAMERA_IP]:8554/cam"`
    - Default: `"rtsp://192.168.1.100:8554/cam"` (update with your camera's IP)
    - Entirely optional; serves as a neat placeholder for security monitors or other ready-to-go camera integrations

2. **Stable Diffusion** (`sd_config.json`)
   - `"sd_api_url": "http://[SD_SERVER_IP]:7860"`
   - Default: `"http://127.0.0.1:7860"` (localhost if running on same machine)

3. **AI Chat Service** (`eai_config.json`)
   - `"eai_api_url": "http://[AI_SERVER_IP]:1234/v1/chat/completions"`
   - Default: `"http://127.0.0.1:1234/v1/chat/completions"` (localhost if running on same machine)

4. **VoiceChat Server** (Settings → VoiceChat Configuration)
   - `https://[VOICE_SERVER_IP]:3000`
   - Configure in user settings after setup

### SSL Certificates
Generate self-signed certificates with your server IPs:
```bash
python generate_cert.py
# Or use the provided scripts:
# Windows: generate_certs.bat
# Linux/Mac: ./generate_certs.sh
```

**Self-Signed Certificate Notes:**
- These are self-generated certificates, not trusted by default browsers due to lack of a recognized Certificate Authority (CA) root.
- Browsers will show security warnings when accessing the site. This is normal for self-signed certs in LAN environments.
- **For downloads and full functionality:** Provide clients with the certificate file (`server_v1_cert.pem`) only (never share the private key `server_v1_key.pem`). Clients should install this certificate in their browser's trusted certificates store to avoid warnings and enable secure downloads.
- Search for instructions on "installing self-signed certificate in [browser name]" (e.g., Chrome, Firefox) for your operating system.

## 🎯 Usage

### Basic Chat
1. Open `https://[YOUR_SERVER_IP]:6969` in your browser
2. Create an account or login
3. Join channels and start chatting
4. Use commands like `/roll 2d20`

### VoiceChat Setup
1. Start separate Node.js voice server on port 3000
2. Configure voice server URL in Settings → VoiceChat
3. Join voice rooms for audio/video communication

### Extensions
- **Chicken Pic**: Camera feed capture (`!chicken`)
- **Stable Diffusion**: AI image generation (`!sd prompt`)
- **AI Chat**: AI-powered responses (`!ai message`)
- **Fun Commands**: Dice rolling (`!roll 2d20`), etc.

### AI Character System

Select from built-in AI character personas for consistent AI interactions. The system features a streamlined card-based interface for easy character selection.

#### Built-in Characters
- **⭐ Helpful Assistant**: Friendly and helpful AI assistant
- **⭐ Smart Assistant**: Intelligent and analytical problem solver
- **⭐ Funny Buddy**: Witty and humorous conversation partner with sarcastic personality

#### Character Selection Interface
- **Visual Cards**: Browse characters in an intuitive card-based grid
- **Quick Selection**: Click any character card to activate it instantly
- **Visual Feedback**: Selected characters are highlighted with accent colors
- **Built-in Distinction**: Built-in characters show a ⭐ star indicator

#### Using Characters
- **Active Character**: Select from character cards in AI settings
- **@ai Mentions**: Channel mentions use your active character personality
- **AI Chat Modal**: Respects your active character for consistent responses
- **Persistent Settings**: Your character choice is saved and remembered
- **Fallback Logic**: Invalid characters automatically fall back to "Helpful Assistant"

**How it works**: Built-in character settings override default AI parameters (temperature, system prompts, custom instructions) during generation, providing consistent personalities across all AI interactions. If a selected character doesn't exist, the system gracefully falls back to the default "Helpful Assistant" character.

## 🏗️ Project Structure

```
├── server_v1_a.py            # Main Flask application
├── lc_*.py                   # Core modules (config, database, routes, sockets)
├── static/                   # Frontend assets (JS, CSS, images)
├── extensions/               # Extension modules
│   ├── fun_commands.py      # Interactive commands
│   ├── chicken_pic.py       # Camera integration
│   ├── sd_integration.py    # Stable Diffusion
│   └── eai_integration.py   # AI chat
├── tests/                    # Test suite
├── *.json                    # Configuration files
├── requirements.txt          # Python dependencies
└── generate_cert.py         # SSL certificate generator
```

## 🔧 Development

### Running Tests
```bash
# Run individual tests
python test_connection_stability.py
python test_command_execution.py

# Note: Clean up ports after testing (6969, 3000, 5001)
```

### Environment Variables
- `FLASKLANCHAT_HTTPS=true/false` (default: true)
- `FLASKLANCHAT_PORT=<port>` (default: 6969)

### Extension Development
Extensions are loaded automatically from the `extensions/` directory. Each extension should have a `setup(command_processor)` function.

## 🐛 Troubleshooting

### Common Issues
- **SSL Certificate Errors**: Regenerate with correct IPs
- **Connection Refused**: Check firewall and port 6969
- **RTSP Connection Failed**: Verify camera IP configuration
- **SD API Errors**: Check Stable Diffusion server configuration
- **VoiceChat Not Working**: Ensure voice server is running on port 3000
- **Database Errors**: Check write permissions

### Network Setup
- Ensure port 6969 is open in firewall
- Use server LAN IP address (not localhost) for network access
- All services must be accessible from client devices

## 🔄 Usage & Modification

This is a **personal boilerplate project** for testing, learning, and experimentation. Feel free to:

- **Fork** this repository for your own experiments
- **Modify** any code to suit your needs
- **Experiment** with new features and integrations
- **Use** this as a working example of how I got things to function. Double check things!

**No pull requests expected** - this is a personal development sandbox. Use it as a starting point for your own projects!

## 📄 License

This project is open-source. See individual files for license information.

---

**Note**: This application requires HTTPS and proper network configuration for full functionality. Ensure all IP addresses are correctly configured before first use.