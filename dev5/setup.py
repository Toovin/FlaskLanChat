#!/usr/bin/env python3
"""
FlaskLanChat Setup Script
Automated setup and configuration for FlaskLanChat server
"""

import os
import json
import subprocess
import sys
from pathlib import Path

def print_banner():
    """Print the setup banner"""
    print("=" * 60)
    print("🚀 FlaskLanChat Automated Setup")
    print("=" * 60)
    print()
    print("This script will help you configure FlaskLanChat for your network.")
    print("You'll need to provide IP addresses for various services.")
    print()

def get_ip_input(service_name, default_port, required=True):
    """Get IP address input from user"""
    while True:
        ip = input(f"Enter {service_name} server IP address: ").strip()
        if not ip and not required:
            return None
        if not ip and required:
            print(f"❌ {service_name} IP is required.")
            continue

        port = input(f"Enter {service_name} port (default: {default_port}): ").strip()
        if not port:
            port = str(default_port)

        try:
            port_num = int(port)
            if 1 <= port_num <= 65535:
                return f"{ip}:{port}"
            else:
                print("❌ Port must be between 1 and 65535")
        except ValueError:
            print("❌ Invalid port number")

def update_config_file(filepath, updates):
    """Update a JSON configuration file"""
    try:
        with open(filepath, 'r') as f:
            config = json.load(f)

        config.update(updates)

        with open(filepath, 'w') as f:
            json.dump(config, f, indent=4)

        print(f"✅ Updated {filepath}")
        return True
    except Exception as e:
        print(f"❌ Failed to update {filepath}: {e}")
        return False

def generate_ssl_certificates(server_ips):
    """Generate SSL certificates for the server"""
    print("\n🔐 Generating SSL Certificates...")

    # Use the first IP as the primary certificate IP
    primary_ip = server_ips[0].split(':')[0]

    # Build subjectAltName extension
    alt_names = ",".join([f"IP:{ip.split(':')[0]}" for ip in server_ips])

    openssl_cmd = f"""
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=CA/L=Network/O=FlaskLanChat/CN={primary_ip}" -addext "subjectAltName={alt_names}"
"""

    try:
        result = subprocess.run(openssl_cmd.strip(), shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ SSL certificates generated successfully!")
            print("   - cert.pem (SSL certificate)")
            print("   - key.pem (private key)")
            return True
        else:
            print("❌ OpenSSL command failed:")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Failed to generate certificates: {e}")
        return False

def main():
    """Main setup function"""
    print_banner()

    # Check if we're in the right directory
    if not Path("server_v5.py").exists():
        print("❌ Error: Please run this script from the FlaskLanChat root directory")
        print("   (the directory containing server_v5.py)")
        sys.exit(1)

    print("📋 Configuration Steps:")
    print("1. General server IP (for SSL certificates)")
    print("2. RTSP camera IP (for chicken_pic extension)")
    print("3. Stable Diffusion API IP")
    print("4. AI Chat API IP")
    print()

    # Get server IPs for SSL certificates
    print("🌐 Step 1: Server IP Configuration")
    print("Enter the IP addresses where FlaskLanChat will be accessible.")
    print("These will be used to generate SSL certificates.")
    print()

    server_ips = []
    primary_ip = get_ip_input("primary server", 6970, required=True)
    server_ips.append(primary_ip)

    while True:
        additional_ip = get_ip_input("additional server (or press Enter to skip)", 6970, required=False)
        if not additional_ip:
            break
        server_ips.append(additional_ip)

    print(f"\n📍 Server will be accessible at: {', '.join(server_ips)}")
    print()

    # Get service IPs
    print("🎥 Step 2: Service Configuration")
    print()

    # RTSP Camera
    rtsp_ip = get_ip_input("RTSP camera", 8554, required=False)
    if rtsp_ip:
        rtsp_url = f"rtsp://{rtsp_ip}/cam"
        update_config_file("chicken_pic_config.json", {"rtsp_url": rtsp_url})
        print(f"   RTSP URL: {rtsp_url}")

    # Stable Diffusion API
    sd_ip = get_ip_input("Stable Diffusion API", 7872, required=False)
    if sd_ip:
        sd_url = f"http://{sd_ip}"
        update_config_file("sd_config.json", {"sd_api_url": sd_url})
        print(f"   SD API URL: {sd_url}")

    # AI Chat API
    ai_ip = get_ip_input("AI Chat API", 12340, required=False)
    if ai_ip:
        ai_url = f"http://{ai_ip}/v1/chat/completions"
        update_config_file("eai_config.json", {"eai_api_url": ai_url})
        print(f"   AI API URL: {ai_url}")

    print("\n🔐 Step 3: SSL Certificate Generation")
    if input("Generate SSL certificates now? (y/N): ").lower().startswith('y'):
        if generate_ssl_certificates(server_ips):
            print("✅ SSL setup complete!")
        else:
            print("⚠️  SSL certificate generation failed.")
            print("   You can generate them manually later with:")
            print("   python generate_cert.py")
    else:
        print("⏭️  Skipping SSL certificate generation.")
        print("   Remember to run: python generate_cert.py")

    print("\n📦 Step 4: Database Initialization")
    if input("Initialize databases now? (y/N): ").lower().startswith('y'):
        print("Initializing main database...")
        try:
            subprocess.run([sys.executable, "init_db.py"], check=True)
            print("✅ Main database initialized")
        except subprocess.CalledProcessError:
            print("❌ Failed to initialize main database")

        print("Initializing adventure database...")
        try:
            subprocess.run([sys.executable, "init_adventure_db.py"], check=True)
            print("✅ Adventure database initialized")
        except subprocess.CalledProcessError:
            print("❌ Failed to initialize adventure database")
    else:
        print("⏭️  Skipping database initialization.")
        print("   Remember to run:")
        print("   python init_db.py")
        print("   python init_adventure_db.py")

    print("\n🎉 Setup Complete!")
    print("=" * 60)
    print("To start the server:")
    print("   python server_v5.py")
    print()
    print("The server will run on port 6970 with databases:")
    print("   - devchat.db (main chat)")
    print("   - dev-adventure.db (city management)")
    print()
    print("Access the chat at:")
    for ip_port in server_ips:
        ip = ip_port.split(':')[0]
        print(f"   https://{ip}:6970")

if __name__ == "__main__":
    main()